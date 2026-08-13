import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button, Card, Muted, Subtitle } from '@/components/ui';
import {
  getSecondaryRole,
  normalizeUserRoles,
} from '@/utils/roles';
import type { UserRole } from '@/types';

/**
 * اختيار مسار ثانٍ واحد (منظم أو لاعب حر) + التبديل بين المتابع والمسار.
 */
export function RolePathCard() {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const align = (isRTL ? 'right' : 'left') as 'left' | 'right';
  const { currentUser, enableSecondaryRole, switchActiveRole } = useTournament();
  const [termsOrg, setTermsOrg] = useState(false);
  const [termsFlr, setTermsFlr] = useState(false);
  const [showOrgTerms, setShowOrgTerms] = useState(false);
  const [showFlrTerms, setShowFlrTerms] = useState(false);

  const normalized = useMemo(
    () => (currentUser ? normalizeUserRoles(currentUser) : null),
    [currentUser]
  );

  if (!normalized || normalized.role === 'superadmin') return null;

  const roleLabel = (role: UserRole) => t(`roles.${role}`);
  const secondary = getSecondaryRole(normalized.roles);
  const active: UserRole = normalized.activeRole || normalized.role;
  // متابع فقط بدون مسار ثانٍ يمكنه الاختيار
  const canChoose =
    !secondary &&
    (normalized.roles.includes('follower') ||
      active === 'follower' ||
      normalized.role === 'follower');

  return (
    <Card
      style={{
        ...styles.card,
        borderWidth: 1.5,
        borderColor: theme.colors.accent,
      }}
    >
      <Subtitle>{t('paths.title')}</Subtitle>
      <Muted>
        {t('paths.current', { role: roleLabel(active) })}
        {secondary
          ? t('paths.enabled', { role: roleLabel(secondary) })
          : t('paths.followerOnly')}
      </Muted>

      {secondary ? (
        <View
          style={[
            styles.switchRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          {normalized.roles.includes('follower') ? (
            <Button
              label={t('paths.switchFollower')}
              variant={active === 'follower' ? 'primary' : 'outline'}
              onPress={() => switchActiveRole('follower')}
              style={{ flex: 1 }}
              disabled={active === 'follower'}
            />
          ) : null}
          <Button
            label={
              secondary === 'organizer'
                ? t('paths.enterOrganizerNow')
                : secondary === 'freelancer'
                  ? t('paths.enterFreelancerNow')
                  : t('paths.switchTo', { role: roleLabel(secondary) })
            }
            variant={active === secondary ? 'primary' : 'outline'}
            onPress={() => switchActiveRole(secondary)}
            style={{ flex: 1 }}
            disabled={active === secondary}
          />
        </View>
      ) : null}

      {canChoose ? (
        <View style={{ gap: 12 }}>
          <Muted>{t('paths.chooseOne')}</Muted>

          <View style={styles.pathBlock}>
            <Button
              label={t('paths.chooseOrganizer')}
              onPress={() => {
                if (!termsOrg) {
                  setShowOrgTerms(true);
                  return;
                }
                void enableSecondaryRole('organizer', true);
              }}
            />
            {showOrgTerms || termsOrg ? (
              <>
                <Text
                  style={[
                    styles.terms,
                    {
                      color: theme.colors.textMuted,
                      textAlign: align,
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                    },
                  ]}
                >
                  {t('paths.organizerTerms')}
                </Text>
                <Pledge
                  checked={termsOrg}
                  label={t('paths.acceptOrganizer')}
                  onToggle={() => setTermsOrg((v) => !v)}
                />
                <Button
                  label={t('paths.confirmOrganizer')}
                  onPress={() => void enableSecondaryRole('organizer', termsOrg)}
                  disabled={!termsOrg}
                />
              </>
            ) : null}
          </View>

          <View style={styles.pathBlock}>
            <Button
              label={t('paths.chooseFreelancer')}
              variant="outline"
              onPress={() => {
                if (!termsFlr) {
                  setShowFlrTerms(true);
                  return;
                }
                void enableSecondaryRole('freelancer', true);
              }}
            />
            {showFlrTerms || termsFlr ? (
              <>
                <Text
                  style={[
                    styles.terms,
                    {
                      color: theme.colors.textMuted,
                      textAlign: align,
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                    },
                  ]}
                >
                  {t('paths.freelancerTerms')}
                </Text>
                <Pledge
                  checked={termsFlr}
                  label={t('paths.acceptFreelancer')}
                  onToggle={() => setTermsFlr((v) => !v)}
                />
                <Button
                  label={t('paths.confirmFreelancer')}
                  variant="outline"
                  onPress={() => void enableSecondaryRole('freelancer', termsFlr)}
                  disabled={!termsFlr}
                />
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {!canChoose && !secondary ? (
        <Muted>{t('paths.demoAccountHint')}</Muted>
      ) : null}
    </Card>
  );
}

function Pledge({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const { isRTL } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.pledge,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: theme.colors.accent,
            backgroundColor: checked ? theme.colors.accent : 'transparent',
          },
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={14} color={theme.colors.textInverse} />
        ) : null}
      </View>
      <Text
        style={[
          styles.pledgeLabel,
          {
            color: theme.colors.text,
            textAlign: 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  switchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pathBlock: { gap: 8 },
  terms: { fontSize: 12, lineHeight: 20 },
  pledge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pledgeLabel: {
    flex: 1,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 20,
  },
});
