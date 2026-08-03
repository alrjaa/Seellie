import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type SupportLevel } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';

type Tab = 'levels' | 'beneficiaries' | 'freelancers' | 'distribution';

export default function SupportScreen() {
  const { supportLevels, supporters, users, giftTransactions, updateSupportLevels } =
    useTournament();
  const theme = useAppTheme();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('levels');
  const [levels, setLevels] = useState<SupportLevel[]>(supportLevels);

  const tabs = useMemo(
    (): { key: Tab; label: string }[] => [
      { key: 'levels', label: t('superadmin.support.tabs.levels') },
      { key: 'beneficiaries', label: t('superadmin.support.tabs.beneficiaries') },
      { key: 'freelancers', label: t('superadmin.support.tabs.freelancers') },
      { key: 'distribution', label: t('superadmin.support.tabs.distribution') },
    ],
    [t]
  );

  useEffect(() => {
    setLevels(supportLevels);
  }, [supportLevels]);

  const freelancers = useMemo(
    () => users.filter((u) => u.role === 'freelancer'),
    [users]
  );

  const saveLevels = () => {
    updateSupportLevels(levels);
    toast({
      variant: 'success',
      title: t('superadmin.support.savedTitle'),
      description: t('superadmin.support.savedDesc'),
    });
  };

  const updateLevel = (
    index: number,
    field: keyof SupportLevel,
    value: string | number
  ) => {
    setLevels((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const renderLevels = () => (
    <View style={{ gap: 10 }}>
      {levels.length === 0 ? (
        <EmptyState title={t('superadmin.support.noLevels')} icon="ribbon-outline" />
      ) : (
        levels.map((level, index) => (
          <Card key={level.name} style={styles.card}>
            <Subtitle>{level.name}</Subtitle>
            <Input
              label={t('superadmin.support.priceLabel')}
              value={String(level.price)}
              onChangeText={(v) =>
                updateLevel(index, 'price', Number(v) || 0)
              }
              keyboardType="numeric"
            />
            <Input
              label={t('superadmin.support.descriptionLabel')}
              value={level.description}
              onChangeText={(v) => updateLevel(index, 'description', v)}
              multiline
            />
          </Card>
        ))
      )}
      <Button label={t('superadmin.support.saveLevels')} onPress={saveLevels} />
    </View>
  );

  const renderBeneficiaries = () => (
    <View style={{ gap: 8 }}>
      {supporters.length === 0 ? (
        <EmptyState
          title={t('superadmin.support.noBeneficiaries')}
          description={t('superadmin.support.noBeneficiariesDesc')}
          icon="people-outline"
        />
      ) : (
        supporters.map((s) => (
          <Card key={s.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {s.name}
            </Text>
            <Muted>
              {s.level} · {s.accountNumber}
            </Muted>
          </Card>
        ))
      )}
    </View>
  );

  const renderFreelancers = () => (
    <View style={{ gap: 8 }}>
      {freelancers.length === 0 ? (
        <EmptyState title={t('superadmin.support.noFreelancers')} icon="person-outline" />
      ) : (
        freelancers.map((f) => (
          <Card key={f.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {f.name}
            </Text>
            <Muted>{f.email}</Muted>
            <Muted>{f.bio || t('superadmin.support.noBio')}</Muted>
          </Card>
        ))
      )}
    </View>
  );

  const renderDistribution = () => (
    <View style={{ gap: 8 }}>
      {giftTransactions.length === 0 ? (
        <EmptyState
          title={t('superadmin.support.noDistribution')}
          description={t('superadmin.support.noDistributionDesc')}
          icon="gift-outline"
        />
      ) : (
        giftTransactions.map((g) => (
          <Card key={g.id} style={styles.card}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {t('superadmin.support.distributionLine', {
                type: g.certificateType,
                recipient: g.recipientName,
              })}
            </Text>
            <Muted>
              {t('superadmin.support.giftLine', {
                gifter: g.gifterName,
                amount: g.amountPaid,
              })}
            </Muted>
          </Card>
        ))
      )}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Title>{t('superadmin.modules.support.title')}</Title>
            <Muted>{t('superadmin.support.subtitle')}</Muted>
            <View style={styles.tabs}>
              {tabs.map((tabItem) => (
                <Pressable
                  key={tabItem.key}
                  onPress={() => setTab(tabItem.key)}
                  style={{ flex: 1 }}
                >
                  <Chip
                    label={tabItem.label}
                    active={tab === tabItem.key}
                    onPress={() => setTab(tabItem.key)}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={() => (
          <>
            {tab === 'levels' ? renderLevels() : null}
            {tab === 'beneficiaries' ? renderBeneficiaries() : null}
            {tab === 'freelancers' ? renderFreelancers() : null}
            {tab === 'distribution' ? renderDistribution() : null}
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  card: { gap: 6 },
  name: { fontWeight: '800', textAlign: 'left' },
});
