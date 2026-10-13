import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DownloadableModel, ModelKind, calculateCompatibility } from '../../ai/ModelCatalog';
import { Icon } from '../common/Icon';
import { ThemeColors } from '../../theme/colors';

interface ModelCardItemProps {
  model: DownloadableModel;
  theme: ThemeColors;
  isModelSwitching: boolean;
  switchingModelId: string | null;
  onStartDownload: (id: string) => void;
  onPauseDownload: (id: string) => void;
  onCancelDownload: (id: string) => void;
  onDelete: (model: DownloadableModel) => void;
  onSetActive: (id: string) => void;
}

const getKindLabel = (kind: ModelKind) => {
  switch (kind) {
    case 'voice_pack':
      return 'VOICE PACK (STT+TTS)';
    case 'voice_ai':
      return 'VOICE AI';
    case 'stt':
      return 'SPEECH-TO-TEXT';
    case 'tts':
      return 'VOICE OUTPUT';
    case 'text':
      return 'TEXT LLM';
    default:
      return (kind as string).toUpperCase();
  }
};

const ModelCardItemComponent: React.FC<ModelCardItemProps> = ({
  model,
  theme,
  isModelSwitching,
  switchingModelId,
  onStartDownload,
  onPauseDownload,
  onCancelDownload,
  onDelete,
  onSetActive,
}) => {
  const compat = calculateCompatibility(model, 8192);
  const isReady = model.status === 'READY';
  const isDownloading = model.status === 'DOWNLOADING';
  const isVerifying = model.status === 'VERIFYING';
  const isPaused = model.status === 'PAUSED';
  const isThisModelSwitching = isModelSwitching && switchingModelId === model.id;

  return (
    <View
      style={[
        styles.modelCard,
        {
          backgroundColor: theme.surface,
          borderColor: model.isActive ? theme.accent : theme.border,
        },
      ]}
    >
      {/* Top Row: Neutral Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.kindBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
            {getKindLabel(model.kind)}
          </Text>
        </View>

        {isReady && (
          <View style={[styles.offlineReadyBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
            <Icon name="check" size={10} color="#10b981" />
            <Text style={styles.offlineReadyText}>100% Offline • Verified</Text>
          </View>
        )}

        <View
          style={[
            styles.compatBadge,
            {
              backgroundColor: theme.surfaceSubtle,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.textMuted }]}>
            {compat === 'GOOD' ? 'RAM OK' : compat}
          </Text>
        </View>
      </View>

      {/* Title & Tagline */}
      <View style={styles.titleSection}>
        <View style={styles.nameRow}>
          <Text style={[styles.modelName, { color: theme.textPrimary }]}>
            {model.name}
          </Text>
          {model.isActive && (
            <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]}>
              <Text style={[styles.activeIndicatorText, { color: theme.textInverse }]}>
                ACTIVE
              </Text>
            </View>
          )}
        </View>
        {!!model.tagline && (
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            {model.tagline}
          </Text>
        )}
      </View>

      {/* Specs Box */}
      <View style={[styles.specsBox, { backgroundColor: theme.surfaceSubtle }]}>
        <View style={styles.specColumn}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>Size</Text>
          <Text style={[styles.specValue, { color: theme.textPrimary }]}>
            {model.sizeFormatted || 'Unknown'}
          </Text>
        </View>
        <View style={styles.specColumn}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>RAM</Text>
          <Text style={[styles.specValue, { color: theme.textPrimary }]}>
            {model.ramFormatted || 'Unknown'}
          </Text>
        </View>
        <View style={styles.specColumn}>
          <Text style={[styles.specLabel, { color: theme.textMuted }]}>Runtime</Text>
          <Text numberOfLines={1} style={[styles.specValue, { color: theme.textPrimary }]}>
            {model.runtime || 'Default'}
          </Text>
        </View>
      </View>

      {/* Progress Bar Container */}
      {(isDownloading || isVerifying || isPaused) && (
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressStatusText, { color: theme.textPrimary }]}>
              {isVerifying
                ? 'Verifying SHA-256...'
                : isPaused
                ? 'Paused'
                : `Downloading ${model.progress || 0}% (${model.downloadSpeed || 'Streaming'})`}
            </Text>
            <Text style={[styles.progressStatusText, { color: theme.textMuted }]}>
              {model.progress || 0}%
            </Text>
          </View>
          <View style={[styles.progressBarTrack, { backgroundColor: theme.surfaceElevated }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: theme.accent, width: `${Math.min(100, Math.max(0, model.progress || 0))}%` },
              ]}
            />
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.cardActionsRow}>
        {isReady ? (
          <View style={styles.readyActionsGroup}>
            <TouchableOpacity
              style={[styles.deleteBtn, { borderColor: theme.border }]}
              onPress={() => onDelete(model)}
              activeOpacity={0.7}
            >
              <Icon name="trash" size={12} color={theme.error} />
              <Text style={[styles.btnText, { color: theme.error, marginLeft: 4 }]}>
                Delete
              </Text>
            </TouchableOpacity>

            {!model.isActive ? (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isThisModelSwitching ? theme.surfaceElevated : theme.accent,
                    opacity: isModelSwitching && !isThisModelSwitching ? 0.6 : 1,
                  },
                ]}
                onPress={() => onSetActive(model.id)}
                disabled={isModelSwitching}
                activeOpacity={0.7}
              >
                {isThisModelSwitching ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.btnTextBold, { color: theme.accent }]}>
                      Activating...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.btnTextBold, { color: theme.textInverse }]}>
                    Set Active
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.activeCheckRow}>
                {isThisModelSwitching ? (
                  <ActivityIndicator size="small" color={theme.warning} style={{ marginRight: 4 }} />
                ) : (
                  <Icon name="check" size={11} color={theme.success} />
                )}
                <Text
                  style={[
                    styles.btnTextBold,
                    {
                      color: isThisModelSwitching ? theme.warning : theme.success,
                      marginLeft: 4,
                    },
                  ]}
                >
                  {isThisModelSwitching ? 'Warming Up...' : 'Active'}
                </Text>
              </View>
            )}
          </View>
        ) : isDownloading ? (
          <View style={styles.downloadControlGroup}>
            <TouchableOpacity
              style={[styles.controlBtn, { borderColor: theme.border }]}
              onPress={() => onPauseDownload(model.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: theme.textPrimary }]}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, { borderColor: theme.border }]}
              onPress={() => onCancelDownload(model.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: theme.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : isPaused ? (
          <View style={styles.downloadControlGroup}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accent }]}
              onPress={() => onStartDownload(model.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnTextBold, { color: theme.textInverse }]}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, { borderColor: theme.border }]}
              onPress={() => onCancelDownload(model.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: theme.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : isVerifying ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <ActivityIndicator size="small" color={theme.textPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.btnText, { color: theme.textMuted }]}>Verifying Integrity...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: theme.accent }]}
            onPress={() => onStartDownload(model.id)}
            activeOpacity={0.8}
          >
            <Icon name="arrowUp" size={11} color={theme.textInverse} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={[styles.btnTextBold, { color: theme.textInverse, marginLeft: 5 }]}>
              Download ({model.sizeFormatted})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const ModelCardItem = memo(ModelCardItemComponent, (prev, next) => {
  return (
    prev.model.id === next.model.id &&
    prev.model.status === next.model.status &&
    prev.model.progress === next.model.progress &&
    prev.model.downloadSpeed === next.model.downloadSpeed &&
    prev.model.isActive === next.model.isActive &&
    prev.theme === next.theme &&
    prev.isModelSwitching === next.isModelSwitching &&
    prev.switchingModelId === next.switchingModelId
  );
});

const styles = StyleSheet.create({
  modelCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  offlineReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  offlineReadyText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 0.2,
  },
  compatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  titleSection: {
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  activeIndicator: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  activeIndicatorText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  specsBox: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  specColumn: {
    flex: 1,
  },
  specLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    marginBottom: 2,
  },
  specValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readyActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  activeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  downloadControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnTextBold: {
    fontSize: 12,
    fontWeight: '700',
  },
});
