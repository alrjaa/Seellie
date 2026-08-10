import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useTournament,
  type Referee,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  EntityAvatarField,
  EntityAvatarEditModal,
} from '@/components/account/EntityAvatarField';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';
import { uniqueRefereesByName } from '@/utils/referee-name';

const REFEREE_ROLE_OPTIONS: {
  value: Referee['role'];
  key: 'pitch' | 'assistant' | 'observer';
}[] = [
  { value: 'حكم ساحة', key: 'pitch' },
  { value: 'رجل خط', key: 'assistant' },
  { value: 'مراقب', key: 'observer' },
];

/**
 * تسجيل حكام لمسابقات المنظم من قائمة مستقلة واضحة.
 */
export default function OrganizerRefereesScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    competitions,
    currentUser,
    referees,
    registerRefereeForCompetition,
    removeRefereeFromCompetition,
    updateReferee,
  } = useTournament();

  const myCompetitions = useMemo(() => {
    if (!currentUser) return [];
    return competitions.filter((c) => c.organizerId === currentUser.id);
  }, [competitions, currentUser]);

  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [refereeName, setRefereeName] = useState('');
  const [refereeRole, setRefereeRole] =
    useState<Referee['role']>('حكم ساحة');
  const [refereeMobile, setRefereeMobile] = useState('');
  const [refereeCity, setRefereeCity] = useState('');
  const [refereeAvatar, setRefereeAvatar] = useState<string | undefined>();
  const [avatarEdit, setAvatarEdit] = useState<{
    id: string;
    name: string;
    value?: string;
  } | null>(null);

  useEffect(() => {
    if (!competitionId && myCompetitions[0]) {
      setCompetitionId(myCompetitions[0].id);
    }
  }, [competitionId, myCompetitions]);

  const selected = useMemo(
    () => myCompetitions.find((c) => c.id === competitionId) || null,
    [myCompetitions, competitionId]
  );

  const assignedRefs = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.refereeIds);
    return uniqueRefereesByName(referees.filter((r) => ids.has(r.id)));
  }, [referees, selected]);

  if (myCompetitions.length === 0) {
    return (
      <Screen contentStyle={styles.content}>
        <Title>{t('organizer.referees.title')}</Title>
        <EmptyState
          title={t('organizer.referees.noCompetitions')}
          icon="trophy-outline"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('organizer.referees.title')}</Title>
      <Muted>{t('organizer.referees.subtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.referees.chooseCompetition')}</Subtitle>
        <View style={styles.chips}>
          {myCompetitions.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={competitionId === c.id}
              onPress={() => setCompetitionId(c.id)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.competitionManage.registerRefereeSection')}</Subtitle>
        <Input
          label={t('organizer.competitionManage.refereeName')}
          value={refereeName}
          onChangeText={setRefereeName}
          placeholder={t('organizer.referees.namePlaceholder')}
        />
        <EntityAvatarField
          value={refereeAvatar}
          name={refereeName || '?'}
          folder="referees"
          onChange={setRefereeAvatar}
          compact
        />
        <Muted>{t('organizer.competitionManage.refereeRole')}</Muted>
        <View style={styles.chips}>
          {REFEREE_ROLE_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={t(
                `organizer.competitionManage.refereeRoles.${option.key}`
              )}
              active={refereeRole === option.value}
              onPress={() => setRefereeRole(option.value)}
            />
          ))}
        </View>
        <Input
          label={t('organizer.competitionManage.refereeMobile')}
          value={refereeMobile}
          onChangeText={setRefereeMobile}
          keyboardType="phone-pad"
        />
        <Input
          label={t('organizer.competitionManage.refereeCity')}
          value={refereeCity}
          onChangeText={setRefereeCity}
        />
        <Button
          label={t('organizer.competitionManage.registerReferee')}
          onPress={() => {
            if (!competitionId) return;
            if (
              registerRefereeForCompetition(competitionId, {
                name: refereeName,
                role: refereeRole,
                mobile: refereeMobile,
                city: refereeCity,
                avatar: refereeAvatar,
              })
            ) {
              setRefereeName('');
              setRefereeMobile('');
              setRefereeCity('');
              setRefereeAvatar(undefined);
              setRefereeRole('حكم ساحة');
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>
          {t('organizer.referees.assignedFor', {
            name: selected?.name || '',
          })}
        </Subtitle>
        {assignedRefs.length === 0 ? (
          <Muted>{t('superadmin.competitionDetail.noAssignedReferees')}</Muted>
        ) : (
          assignedRefs.map((ref) => (
            <View
              key={ref.id}
              style={[styles.refRow, { borderTopColor: theme.colors.border }]}
            >
              <Avatar uri={ref.avatar} name={ref.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {ref.name}
                </Text>
                <Muted>{ref.role}</Muted>
                {ref.mobile ? <Muted>{ref.mobile}</Muted> : null}
                <Pressable
                  onPress={() =>
                    setAvatarEdit({
                      id: ref.id,
                      name: ref.name,
                      value: ref.avatar,
                    })
                  }
                  hitSlop={6}
                >
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {t('media.changeHandleIcon')}
                  </Text>
                </Pressable>
              </View>
              {selected ? (
                <Pressable
                  onPress={() =>
                    removeRefereeFromCompetition(
                      selected.id,
                      ref.id,
                      t('organizer.competitionManage.refereeRemoved', {
                        name: ref.name,
                      })
                    )
                  }
                >
                  <Text
                    style={{
                      color: theme.colors.danger,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {t('organizer.competitionManage.remove')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </Card>

      {avatarEdit ? (
        <EntityAvatarEditModal
          visible
          title={`${t('media.changeHandleIcon')} — ${avatarEdit.name}`}
          value={avatarEdit.value}
          name={avatarEdit.name}
          folder="referees"
          onChange={(url) => {
            const current = referees.find((r) => r.id === avatarEdit.id);
            if (current) {
              updateReferee(
                { ...current, avatar: url },
                t('media.entityPhotoUpdated')
              );
            }
            setAvatarEdit((prev) =>
              prev ? { ...prev, value: url } : prev
            );
          }}
          onClose={() => setAvatarEdit(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  name: { fontWeight: '800', textAlign: 'left' },
});
