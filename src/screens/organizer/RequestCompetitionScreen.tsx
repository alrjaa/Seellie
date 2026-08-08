import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import {
  Button,
  Card,
  Input,
  Muted,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';
import {
  COMPETITION_ORG_TERMS,
  MIN_COMPETITION_TEAMS,
} from '@/utils/competition-request';
import { isSupabaseConfigured } from '@/services/supabase';

function PledgeRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onToggle} style={styles.pledgeRow} accessibilityRole="checkbox">
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
      <Text style={[styles.pledgeLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function RequestCompetitionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    currentUser,
    competitionRequests,
    applyForCompetition,
    refreshCloudCompetitionRequests,
    deleteCompetitionRequest,
  } = useTournament();

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured()) return;
      void refreshCloudCompetitionRequests();
    }, [refreshCloudCompetitionRequests])
  );

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [venueName, setVenueName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [diligencePledge, setDiligencePledge] = useState(false);
  const [stadiumPledge, setStadiumPledge] = useState(false);
  const [minTeamsPledge, setMinTeamsPledge] = useState(false);
  const [firstAidPledge, setFirstAidPledge] = useState(false);
  const [orderPledge, setOrderPledge] = useState(false);

  const myRequests = useMemo(
    () =>
      competitionRequests.filter((r) => r.organizerId === currentUser?.id),
    [competitionRequests, currentUser?.id]
  );

  const confirmDeleteRequest = useCallback(
    (requestId: string, requestName: string) => {
      Alert.alert(
        t('organizer.requestCompetition.deleteRequest'),
        `${t('organizer.requestCompetition.deleteRequestConfirm')}\n«${requestName}»`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('organizer.requestCompetition.deleteRequest'),
            style: 'destructive',
            onPress: () => {
              void deleteCompetitionRequest(
                requestId,
                t('organizer.requestCompetition.requestDeleted')
              );
            },
          },
        ]
      );
    },
    [deleteCompetitionRequest, t]
  );

  const canSubmit =
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    city.trim().length > 0 &&
    neighborhood.trim().length > 0 &&
    termsAccepted &&
    diligencePledge &&
    stadiumPledge &&
    minTeamsPledge &&
    firstAidPledge &&
    orderPledge;

  const submit = useCallback(async () => {
    const ok = await applyForCompetition({
      name,
      region,
      city,
      neighborhood,
      venueName,
      termsAccepted,
      diligencePledge,
      stadiumPledge,
      minTeamsPledge,
      firstAidPledge,
      orderPledge,
    });
    if (ok) {
      setName('');
      setRegion('');
      setCity('');
      setNeighborhood('');
      setVenueName('');
      setTermsAccepted(false);
      setDiligencePledge(false);
      setStadiumPledge(false);
      setMinTeamsPledge(false);
      setFirstAidPledge(false);
      setOrderPledge(false);
    }
  }, [
    applyForCompetition,
    name,
    region,
    city,
    neighborhood,
    venueName,
    termsAccepted,
    diligencePledge,
    stadiumPledge,
    minTeamsPledge,
    firstAidPledge,
    orderPledge,
  ]);

  return (
    <Screen scroll keyboard contentStyle={styles.scroll}>
        <Subtitle>{t('organizer.requestCompetition.title')}</Subtitle>
        <Muted>
          {t('organizer.requestCompetition.subtitle', {
            count: MIN_COMPETITION_TEAMS,
          })}
        </Muted>

        <Card style={styles.card}>
          <Input
            label={t('organizer.requestCompetition.competitionName')}
            value={name}
            onChangeText={setName}
            placeholder={t('organizer.requestCompetition.competitionNamePlaceholder')}
          />
          <Input
            label={t('organizer.requestCompetition.region')}
            value={region}
            onChangeText={setRegion}
            placeholder={t('organizer.requestCompetition.regionPlaceholder')}
          />
          <Input
            label={t('organizer.requestCompetition.city')}
            value={city}
            onChangeText={setCity}
            placeholder={t('organizer.requestCompetition.cityPlaceholder')}
          />
          <Input
            label={t('organizer.requestCompetition.neighborhood')}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder={t('organizer.requestCompetition.neighborhoodPlaceholder')}
          />
          <Input
            label={t('organizer.requestCompetition.venueNameOptional')}
            value={venueName}
            onChangeText={setVenueName}
            placeholder={t('organizer.requestCompetition.venueNamePlaceholder')}
          />
        </Card>

        <Card style={styles.card}>
          <Subtitle>{t('organizer.requestCompetition.termsSection')}</Subtitle>
          <Text style={[styles.termsBody, { color: theme.colors.textMuted }]}>
            {COMPETITION_ORG_TERMS}
          </Text>
          <PledgeRow
            checked={termsAccepted}
            onToggle={() => setTermsAccepted((v) => !v)}
            label={t('organizer.requestCompetition.pledgeTerms')}
          />
          <PledgeRow
            checked={diligencePledge}
            onToggle={() => setDiligencePledge((v) => !v)}
            label={t('organizer.requestCompetition.pledgeDiligence')}
          />
          <PledgeRow
            checked={stadiumPledge}
            onToggle={() => setStadiumPledge((v) => !v)}
            label={t('organizer.requestCompetition.pledgeStadium')}
          />
          <PledgeRow
            checked={minTeamsPledge}
            onToggle={() => setMinTeamsPledge((v) => !v)}
            label={t('organizer.requestCompetition.pledgeMinTeams', {
              count: MIN_COMPETITION_TEAMS,
            })}
          />
          <PledgeRow
            checked={firstAidPledge}
            onToggle={() => setFirstAidPledge((v) => !v)}
            label={t('organizer.requestCompetition.pledgeFirstAid')}
          />
          <PledgeRow
            checked={orderPledge}
            onToggle={() => setOrderPledge((v) => !v)}
            label={t('organizer.requestCompetition.pledgeOrder')}
          />
          <Button
            label={t('organizer.requestCompetition.submit')}
            onPress={submit}
            disabled={!canSubmit}
          />
        </Card>

        {myRequests.length > 0 ? (
          <Card style={styles.card}>
            <Subtitle>{t('organizer.requestCompetition.previousRequests')}</Subtitle>
            {myRequests.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.requestRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.reqName, { color: theme.colors.text }]}>
                  {r.name}
                </Text>
                <Muted>
                  {r.region} · {r.city} · {r.neighborhood}
                </Muted>
                <Muted>
                  {t(`organizer.requestCompetition.requestStatus.${r.status}`)}
                  {r.requestedAt
                    ? ` · ${formatArabicDate(r.requestedAt)}`
                    : ''}
                </Muted>
                {r.status === 'rejected' && r.rejectionReason ? (
                  <Muted>
                    {t('superadmin.labels.reason')}: {r.rejectionReason}
                  </Muted>
                ) : null}
                {r.status === 'approved' && r.competitionId ? (
                  <Button
                    label={t('organizer.requestCompetition.openCompetition')}
                    variant="secondary"
                    onPress={() =>
                      router.push(`/(organizer)/competitions/${r.competitionId}`)
                    }
                  />
                ) : null}
                <Button
                  label={t('organizer.requestCompetition.deleteRequest')}
                  variant="danger"
                  onPress={() => confirmDeleteRequest(r.id, r.name)}
                />
              </View>
            ))}
          </Card>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingTop: 8 },
  card: { gap: 12 },
  termsBody: {
    textAlign: 'left',
    lineHeight: 22,
    fontSize: 13,
  },
  pledgeRow: {
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
    textAlign: 'left',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 20,
  },
  requestRow: {
    gap: 4,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reqName: { fontWeight: '800', textAlign: 'left', fontSize: 15 },
});
