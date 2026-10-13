import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AppState,
} from 'react-native';
import { useAssistant } from '../../store/AssistantStore';
import { PermissionService } from '../../services/PermissionService';
import { PermissionItem } from '../../native/AndroidNativeTypes';
import { Icon } from '../common/Icon';
import { typography } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

export const PermissionSetupScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { theme, completeOnboarding } = useAssistant();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = async () => {
    setIsLoading(true);
    const items = await PermissionService.getPermissionItems();
    setPermissions(items);
    setIsLoading(false);
  };

  useEffect(() => {
    loadPermissions();

    // Re-check permissions when user returns from settings
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadPermissions();
      }
    });

    return () => sub.remove();
  }, []);

  const handleAction = async (item: PermissionItem) => {
    switch (item.kind) {
      case 'MICROPHONE':
        await PermissionService.requestMicrophone();
        break;
      case 'NOTIFICATIONS':
        await PermissionService.requestNotifications();
        break;
      case 'ACCESSIBILITY':
        await PermissionService.openAccessibilitySettings();
        break;
      case 'BATTERY_OPTIMIZATION':
        await PermissionService.openBatteryOptimizationSettings();
        break;
      case 'STORAGE':
        await PermissionService.openAppSettings();
        break;
    }
    loadPermissions();
  };

  const handleContinue = () => {
    completeOnboarding();
    if (onComplete) {
      onComplete();
    }
  };

  const allRecommendedGranted = permissions
    .filter(p => p.category === 'RECOMMENDED')
    .every(p => p.isGranted);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIconBox, { backgroundColor: theme.accent }]}>
            <Icon name="sparkles" size={14} color={theme.textInverse} />
          </View>
          <Text style={[typography.title, { color: theme.textPrimary }]}>Sara AI</Text>
        </View>
        <Text style={[typography.h2, styles.mainTitle, { color: theme.textPrimary }]}>
          Permission Setup
        </Text>
        <Text style={[typography.caption, { color: theme.textSecondary }]}>
          Configure on-device privileges to enable voice, background, and automation capabilities.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* First-Run Status Checklist */}
        <View style={[styles.checklistCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[typography.small, styles.checklistHeader, { color: theme.textMuted }]}>
            Assistant Setup Progress
          </Text>

          <View style={styles.checkItem}>
            <View style={[styles.checkDot, { backgroundColor: theme.success }]}>
              <Icon name="check" size={10} color="#FFFFFF" />
            </View>
            <Text style={[typography.captionMedium, { color: theme.textPrimary }]}>App Initialized</Text>
          </View>

          <View style={styles.checkItem}>
            <View style={[styles.checkDot, { backgroundColor: allRecommendedGranted ? theme.success : theme.surfaceElevated }]}>
              {allRecommendedGranted && <Icon name="check" size={10} color="#FFFFFF" />}
            </View>
            <Text style={[typography.captionMedium, { color: allRecommendedGranted ? theme.textPrimary : theme.textMuted }]}>
              Permissions Configured
            </Text>
          </View>

          <View style={styles.checkItem}>
            <View style={[styles.checkDot, { backgroundColor: theme.surfaceElevated }]} />
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              AI Model Store (Gemma 3 1B)
            </Text>
          </View>

          <View style={styles.checkItem}>
            <View style={[styles.checkDot, { backgroundColor: theme.surfaceElevated }]} />
            <Text style={[typography.caption, { color: theme.textMuted }]}>
              Offline Voice Pack (STT & TTS)
            </Text>
          </View>
        </View>

        {/* Permissions List */}
        <View style={styles.permissionsList}>
          {permissions.map(item => {
            const isGranted = item.isGranted;

            return (
              <View
                key={item.kind}
                style={[
                  styles.permCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isGranted ? theme.borderSubtle : theme.border,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleCol}>
                    <View style={styles.titleWithBadge}>
                      <Text style={[typography.bodyBold, { color: theme.textPrimary }]}>
                        {item.title}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor:
                              item.category === 'REQUIRED'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : item.category === 'RECOMMENDED'
                                ? theme.accentSubtle
                                : theme.surfaceElevated,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.small,
                            {
                              color:
                                item.category === 'REQUIRED'
                                  ? theme.error
                                  : item.category === 'RECOMMENDED'
                                  ? theme.textPrimary
                                  : theme.textMuted,
                              fontSize: 10,
                            },
                          ]}
                        >
                          {item.category}
                        </Text>
                      </View>
                    </View>
                    <Text style={[typography.caption, styles.permDesc, { color: theme.textSecondary }]}>
                      {item.description}
                    </Text>
                  </View>
                </View>

                {/* Action button */}
                <View style={styles.actionRow}>
                  {isGranted ? (
                    <View style={styles.grantedBadge}>
                      <Icon name="check" size={13} color={theme.success} />
                      <Text style={[typography.captionBold, { color: theme.success, marginLeft: 4 }]}>
                        Granted
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[
                        styles.allowBtn,
                        {
                          backgroundColor: item.category === 'RECOMMENDED' ? theme.accent : theme.surfaceElevated,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => handleAction(item)}
                    >
                      <Text
                        style={[
                          typography.captionBold,
                          {
                            color: item.category === 'RECOMMENDED' ? theme.textInverse : theme.textPrimary,
                          },
                        ]}
                      >
                        {item.actionLabel}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Continue bar */}
      <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.borderSubtle }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.accent }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={[typography.bodyBold, { color: theme.textInverse }]}>
            Continue Setup
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  brandIconBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  mainTitle: {
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  checklistCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  checklistHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  permissionsList: {
    gap: spacing.md,
  },
  permCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitleCol: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  permDesc: {
    marginTop: 2,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  allowBtn: {
    paddingVertical: 7,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  grantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  bottomBar: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  continueButton: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
