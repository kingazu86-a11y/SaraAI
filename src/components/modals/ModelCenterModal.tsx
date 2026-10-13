import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistant } from '../../store/AssistantStore';
import { DownloadableModel, ModelKind } from '../../ai/ModelCatalog';
import { Icon } from '../common/Icon';
import { spacing, radius } from '../../theme/spacing';
import { ModelService } from '../../services/ModelService';
import { RealtimeCatalogService, RealtimeSyncStatus } from '../../services/RealtimeCatalogService';
import { ModelCardItem } from './ModelCardItem';

type FilterTab = 'voice' | 'text' | 'installed' | 'all';

export const ModelCenterModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    models,
    startDownloadModel,
    pauseDownloadModel,
    cancelDownloadModel,
    deleteModel,
    setActiveModel,
    activeVoiceModel,
    storageInfo,
    fetchModelsFromBackend,
    fetchVoicePacksFromBackend,
    theme,
    themeMode,
    isModelSwitching,
    switchingModelId,
  } = useAssistant();

  const insets = useSafeAreaInsets();
  const isVisible = activeModal === 'model_manager';
  const scrollRef = useRef<ScrollView>(null);

  // Ref to always access current models without causing re-render loops in callbacks
  const modelsRef = useRef<DownloadableModel[]>(models);
  modelsRef.current = models;

  // Active Tab & Search State
  const [selectedTab, setSelectedTab] = useState<FilterTab>('voice');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Data & Network State
  const [serverItems, setServerItems] = useState<DownloadableModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSyncStatus>('disconnected');

  // Request race-condition counter
  const inFlightReqId = useRef<number>(0);

  // 1. Debounce Search Input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Realtime Synchronization Lifecycle
  useEffect(() => {
    if (!isVisible) return;
    RealtimeCatalogService.start();
    const unsubStatus = RealtimeCatalogService.subscribeStatus(st => {
      setRealtimeStatus(st);
    });
    return () => {
      unsubStatus();
    };
  }, [isVisible]);

  // Helper to retrieve fallback / immediate items from memory
  const getImmediateItems = useCallback((tab: FilterTab, search: string): DownloadableModel[] => {
    const catalog = modelsRef.current.length > 0 ? modelsRef.current : ModelService.getModels();
    let filtered = catalog;
    if (tab === 'voice') {
      filtered = catalog.filter(m => m.kind === 'voice_pack' || m.kind === 'voice_ai' || m.kind === 'stt' || m.kind === 'tts');
    } else if (tab === 'text') {
      filtered = catalog.filter(m => m.kind === 'text' || m.kind === 'vision' || m.kind === 'multimodal');
    } else if (tab === 'installed') {
      filtered = catalog.filter(m => m.status === 'READY');
    }
    if (search) {
      filtered = filtered.filter(m => ModelService.matchesSearch(m, search));
    }
    return filtered;
  }, []);

  // 3. Robust Data Loader (Prevents infinite update depth loop)
  const fetchData = useCallback(
    async (
      targetPage: number,
      tab: FilterTab,
      search: string,
      force = false
    ) => {
      const reqId = ++inFlightReqId.current;

      // SWR: Keep showing previous items while syncing
      if (serverItems.length === 0) {
        setIsLoading(true);
      } else {
        setIsSyncing(true);
      }
      setServerError(null);

      try {
        let paginatedResult;

        if (tab === 'installed') {
          paginatedResult = ModelService.fetchInstalledModels({
            page: targetPage,
            limit: pageSize,
            search,
          });
        } else if (tab === 'voice') {
          paginatedResult = await fetchVoicePacksFromBackend({
            page: targetPage,
            limit: pageSize,
            search,
            forceRefresh: force,
          });
        } else {
          const kind = tab === 'text' ? 'text' : 'all';
          paginatedResult = await fetchModelsFromBackend({
            page: targetPage,
            limit: pageSize,
            kind,
            search,
            forceRefresh: force,
          });
        }

        // Drop out-of-order response if user changed tab/page during request
        if (reqId !== inFlightReqId.current) return;

        if (paginatedResult && paginatedResult.success) {
          setServerItems(paginatedResult.data);
          setPage(paginatedResult.page);
          setTotalPages(paginatedResult.totalPages);
          setTotalCount(paginatedResult.total);
          setHasMore(paginatedResult.hasMore);
        } else {
          const fallback = getImmediateItems(tab, search);
          const pagedFallback = ModelService.paginateList(fallback, targetPage, pageSize);
          setServerItems(pagedFallback.data);
          setPage(pagedFallback.page);
          setTotalPages(pagedFallback.totalPages);
          setTotalCount(pagedFallback.total);
          setHasMore(pagedFallback.hasMore);
        }
      } catch (err: any) {
        if (reqId !== inFlightReqId.current) return;
        const fallback = getImmediateItems(tab, search);
        const pagedFallback = ModelService.paginateList(fallback, targetPage, pageSize);
        setServerItems(pagedFallback.data);
        setPage(pagedFallback.page);
        setTotalPages(pagedFallback.totalPages);
        setTotalCount(pagedFallback.total);
        setHasMore(pagedFallback.hasMore);
        if (fallback.length === 0) {
          setServerError(err?.message || 'Could not connect to cloud repository.');
        }
      } finally {
        if (reqId === inFlightReqId.current) {
          setIsLoading(false);
          setIsSyncing(false);
        }
      }
    },
    [pageSize, fetchVoicePacksFromBackend, fetchModelsFromBackend, getImmediateItems, serverItems.length]
  );

  // 4. Stable Effect: Trigger fetch ONLY on modal open, tab switch, debounced search, or page size change
  useEffect(() => {
    if (!isVisible) return;
    fetchData(1, selectedTab, debouncedSearch, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, selectedTab, debouncedSearch, pageSize]);

  // 5. Subscribe to Background / Realtime Catalog Updates without re-triggering fetch loops
  useEffect(() => {
    if (!isVisible) return;
    const unsub = ModelService.subscribeCatalog(() => {
      // Re-evaluate current page seamlessly in background
      fetchData(page, selectedTab, debouncedSearch, false);
    });
    return unsub;
  }, [isVisible, page, selectedTab, debouncedSearch, fetchData]);

  // Tab switcher
  const handleSelectTab = (tab: FilterTab) => {
    if (tab === selectedTab) return;
    setSelectedTab(tab);
    setPage(1);
    setServerError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    // Instant local preview for 0ms transition
    const immediate = getImmediateItems(tab, debouncedSearch);
    const paged = ModelService.paginateList(immediate, 1, pageSize);
    setServerItems(paged.data);
    setTotalPages(paged.totalPages);
    setTotalCount(paged.total);
  };

  // Page switcher
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page || isLoading) return;
    setPage(newPage);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    fetchData(newPage, selectedTab, debouncedSearch, false);
  };

  // Merge live download status from models state reactively
  const itemsToDisplay = useMemo(() => {
    return serverItems.map(item => {
      const live = models.find(m => m.id === item.id);
      return live ? { ...item, ...live } : item;
    });
  }, [serverItems, models]);

  const installedCount = useMemo(() => models.filter(m => m.status === 'READY').length, [models]);

  const handleDelete = useCallback((model: DownloadableModel) => {
    Alert.alert(
      'Delete Model',
      `Delete "${model.name}" (${model.sizeFormatted}) from device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteModel(model.id) },
      ]
    );
  }, [deleteModel]);

  const handleCancelDownload = useCallback((modelId: string) => {
    cancelDownloadModel(modelId);
  }, [cancelDownloadModel]);

  const handlePauseDownload = useCallback((modelId: string) => {
    pauseDownloadModel(modelId);
  }, [pauseDownloadModel]);

  const handleStartDownload = useCallback((modelId: string) => {
    startDownloadModel(modelId);
  }, [startDownloadModel]);

  const handleSetActive = useCallback((modelId: string) => {
    setActiveModel(modelId);
  }, [setActiveModel]);

  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={closeModal}
      statusBarTranslucent={true}
    >
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: topInset }]}>
        <StatusBar
          barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent={true}
        />
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.borderSubtle }]}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              Model Center
            </Text>
          </View>
          <TouchableOpacity
            onPress={closeModal}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={16} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtle Requirement Status Banner */}
          <View
            style={[
              styles.requirementBanner,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.reqHeaderRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: activeVoiceModel ? theme.success : theme.textMuted },
                ]}
              />
              <Text style={[styles.reqStatusText, { color: theme.textPrimary }]}>
                {activeVoiceModel ? 'Voice Model Active' : 'Voice Model Required'}
              </Text>
            </View>
            <Text style={[styles.reqDescText, { color: theme.textMuted }]}>
              {activeVoiceModel
                ? `Active: ${activeVoiceModel.name}`
                : 'A voice-to-text model is required to enable voice AI capabilities.'}
            </Text>
          </View>

          {/* Minimal Storage Info Card */}
          <View style={[styles.storageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.storageRow}>
              <View style={styles.storageCol}>
                <Text style={[styles.storageLabel, { color: theme.textMuted }]}>Installed</Text>
                <Text style={[styles.storageValue, { color: theme.textPrimary }]}>{installedCount}</Text>
              </View>
              <View style={[styles.vertDivider, { backgroundColor: theme.borderSubtle }]} />
              <View style={styles.storageCol}>
                <Text style={[styles.storageLabel, { color: theme.textMuted }]}>Used</Text>
                <Text style={[styles.storageValue, { color: theme.textPrimary }]}>
                  {formatGb(storageInfo.modelsUsedBytes)} GB
                </Text>
              </View>
              <View style={[styles.vertDivider, { backgroundColor: theme.borderSubtle }]} />
              <View style={styles.storageCol}>
                <Text style={[styles.storageLabel, { color: theme.textMuted }]}>Free Storage</Text>
                <Text style={[styles.storageValue, { color: theme.textPrimary }]}>
                  {formatGb(storageInfo.availableBytes)} GB
                </Text>
              </View>
            </View>
            <View style={[styles.storagePathRow, { borderTopColor: theme.borderSubtle }]}>
              <Icon name="cpu" size={12} color={theme.textMuted} />
              <Text style={[styles.storagePathText, { color: theme.textMuted }]} numberOfLines={1}>
                Target: Android/obb/com.saraai.offline.assistant/Models
              </Text>
            </View>
          </View>

          {/* Sara AI Neural Cloud Banner with Realtime Status */}
          <View style={[styles.cloudHubBanner, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            <View style={styles.cloudHubHeaderRow}>
              <View style={styles.cloudHubStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        realtimeStatus === 'connected'
                          ? '#10b981'
                          : realtimeStatus === 'connecting'
                          ? '#f59e0b'
                          : theme.textMuted,
                    },
                  ]}
                />
                <Text style={[styles.cloudHubTitle, { color: theme.textPrimary }]}>Sara AI Neural Cloud</Text>
              </View>
              <TouchableOpacity
                style={[styles.cloudBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={() => RealtimeCatalogService.syncNow()}
                activeOpacity={0.7}
              >
                {isSyncing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.accent} style={{ transform: [{ scale: 0.65 }], marginRight: 4 }} />
                    <Text style={[styles.cloudBadgeText, { color: theme.accent }]}>Syncing...</Text>
                  </View>
                ) : realtimeStatus === 'connected' ? (
                  <Text style={[styles.cloudBadgeText, { color: '#10b981' }]}>Realtime Sync Active</Text>
                ) : (
                  <Text style={[styles.cloudBadgeText, { color: theme.accent }]}>Cloud Online</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.cloudHubSubtitle, { color: theme.textMuted }]}>
              High-speed direct model streaming • Background notifications active
            </Text>
          </View>

          {/* Monochromatic Segmented Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {[
              { label: 'Voice Models (STT)', value: 'voice' as FilterTab },
              { label: 'Text LLMs', value: 'text' as FilterTab },
              { label: `Installed (${installedCount})`, value: 'installed' as FilterTab },
              { label: 'All Models', value: 'all' as FilterTab },
            ].map(tab => {
              const isSelected = selectedTab === tab.value;
              return (
                <TouchableOpacity
                  key={tab.value}
                  style={[
                    styles.tabBtn,
                    {
                      borderColor: isSelected ? theme.accent : theme.border,
                      backgroundColor: isSelected ? theme.accent : theme.surface,
                    },
                  ]}
                  onPress={() => handleSelectTab(tab.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: isSelected ? theme.textInverse : theme.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search Input Bar (Debounced with Instant Feedback) */}
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name="terminal" size={13} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${selectedTab === 'installed' ? 'installed models' : 'models & voice packs'}...`}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                }}
                style={{ padding: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={13} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Models List */}
          <View style={styles.modelsList}>
            {isLoading && itemsToDisplay.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: theme.borderSubtle, paddingVertical: 32 }]}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={[styles.emptyText, { color: theme.textSecondary, marginTop: 12 }]}>
                  Loading from Sara AI Cloud...
                </Text>
              </View>
            ) : serverError && selectedTab !== 'installed' && itemsToDisplay.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: theme.error, paddingVertical: 20 }]}>
                <Text style={[styles.emptyText, { color: theme.error, fontWeight: '700' }]}>
                  {serverError}
                </Text>
                <Text style={[styles.emptyText, { color: theme.textMuted, marginTop: 4, fontSize: 11 }]}>
                  Could not reach Sara AI Cloud. Please check your network connection.
                </Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: theme.accent, marginTop: 12 }]}
                  onPress={() => fetchData(page, selectedTab, debouncedSearch, true)}
                >
                  <Text style={[styles.btnTextBold, { color: theme.textInverse }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : itemsToDisplay.length === 0 ? (
              <View style={[styles.emptyBox, { borderColor: theme.borderSubtle }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  {searchQuery
                    ? `No models found matching "${searchQuery}".`
                    : selectedTab === 'installed'
                    ? 'No models installed on device yet. Download models from Voice Packs or LLMs tab for 100% offline usage.'
                    : `No models found in cloud catalog for '${selectedTab}'.`}
                </Text>
                {searchQuery ? (
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderWidth: 1, marginTop: 10 }]}
                    onPress={() => {
                      setSearchQuery('');
                      setDebouncedSearch('');
                    }}
                  >
                    <Text style={[styles.btnText, { color: theme.textPrimary }]}>Clear Search</Text>
                  </TouchableOpacity>
                ) : selectedTab !== 'installed' && (
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderWidth: 1, marginTop: 10 }]}
                    onPress={() => fetchData(1, selectedTab, '', true)}
                  >
                    <Text style={[styles.btnText, { color: theme.textPrimary }]}>Refresh Catalog</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              itemsToDisplay.map(model => (
                <ModelCardItem
                  key={model.id}
                  model={model}
                  theme={theme}
                  isModelSwitching={isModelSwitching}
                  switchingModelId={switchingModelId}
                  onStartDownload={handleStartDownload}
                  onPauseDownload={handlePauseDownload}
                  onCancelDownload={handleCancelDownload}
                  onDelete={handleDelete}
                  onSetActive={handleSetActive}
                />
              ))
            )}

            {/* Complete Multi-Tab Pagination Controls */}
            {totalCount > 0 && (
              <View style={[styles.paginationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={[
                    styles.pageNavBtn,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                    page <= 1 && styles.pageNavBtnDisabled,
                  ]}
                  disabled={page <= 1 || isLoading}
                  onPress={() => handlePageChange(page - 1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNavText, { color: page <= 1 ? theme.textMuted : theme.textPrimary }]}>
                    ◀ Prev
                  </Text>
                </TouchableOpacity>

                <View style={styles.pageCenterCol}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <>
                      <Text style={[styles.pageNumberText, { color: theme.textPrimary }]}>
                        Page {page} of {Math.max(1, totalPages)}
                      </Text>
                      <Text style={[styles.pageSubText, { color: theme.textMuted }]}>
                        Showing {Math.min((page - 1) * pageSize + 1, totalCount)}-{Math.min(page * pageSize, totalCount)} of {totalCount}
                      </Text>
                    </>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.pageNavBtn,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                    (page >= totalPages || !hasMore) && styles.pageNavBtnDisabled,
                  ]}
                  disabled={page >= totalPages || !hasMore || isLoading}
                  onPress={() => handlePageChange(page + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNavText, { color: (page >= totalPages || !hasMore) ? theme.textMuted : theme.textPrimary }]}>
                    Next ▶
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Per-Page Selector */}
            {totalCount > 5 && (
              <View style={styles.pageSizeRow}>
                <Text style={[styles.pageSizeLabel, { color: theme.textMuted }]}>Items per page:</Text>
                {[5, 10, 20].map(sz => (
                  <TouchableOpacity
                    key={sz}
                    style={[
                      styles.pageSizeBtn,
                      {
                        borderColor: pageSize === sz ? theme.accent : theme.border,
                        backgroundColor: pageSize === sz ? theme.accent : theme.surfaceSubtle,
                      },
                    ]}
                    onPress={() => {
                      if (pageSize === sz) return;
                      setPageSize(sz);
                      setPage(1);
                    }}
                  >
                    <Text
                      style={[
                        styles.pageSizeText,
                        { color: pageSize === sz ? theme.textInverse : theme.textSecondary },
                      ]}
                    >
                      {sz}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  header: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerTitleCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  requirementBanner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  reqStatusText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  reqDescText: {
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 15,
  },
  storageCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storageCol: {
    alignItems: 'center',
    flex: 1,
  },
  storageLabel: {
    fontSize: 9.5,
  },
  storageValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  vertDivider: {
    width: 1,
    height: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  modelsList: {
    gap: spacing.xs,
  },
  emptyBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  storagePathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  storagePathText: {
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  cloudHubBanner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 10,
    marginBottom: spacing.sm,
  },
  cloudHubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cloudHubStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  cloudHubTitle: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  cloudHubSubtitle: {
    fontSize: 10,
    marginTop: 4,
  },
  cloudBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  cloudBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paginationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  pageNavBtn: {
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pageNavBtnDisabled: {
    opacity: 0.35,
  },
  pageNavText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pageCenterCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageSubText: {
    fontSize: 10,
    marginTop: 2,
  },
  pageSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  pageSizeLabel: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  pageSizeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  pageSizeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 2,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  btnTextBold: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
