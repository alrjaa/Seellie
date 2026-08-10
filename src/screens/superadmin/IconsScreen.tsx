import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '@/providers/ToastProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { confirmDestructive } from '@/utils/confirm';
import type { FabIconConfig } from '@/types/fab-icons';

export default function IconsScreen() {
  const theme = useAppTheme();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { fabIcons, setFabIcons } = useTournament();
  const [editing, setEditing] = useState<FabIconConfig | null>(null);
  const [label, setLabel] = useState('');
  const [iconName, setIconName] = useState('');
  const [href, setHref] = useState('');
  const [saving, setSaving] = useState(false);

  const isFormOpen = editing !== null || label.length > 0;

  const resetForm = () => {
    setEditing(null);
    setLabel('');
    setIconName('');
    setHref('');
  };

  const openAdd = () => {
    resetForm();
    setEditing({ id: '', label: '', icon: 'add-outline', href: '' });
  };

  const openEdit = (item: FabIconConfig) => {
    setEditing(item);
    setLabel(item.label);
    setIconName(item.icon);
    setHref(item.href);
  };

  const save = () => {
    if (saving) return;
    if (!label.trim() || !iconName.trim() || !href.trim()) {
      toast({
        variant: 'destructive',
        title: t('toasts.t036_3a814a'),
        description: t('superadmin.icons.completeFields'),
      });
      return;
    }

    setSaving(true);
    try {
      const entry: FabIconConfig = {
        id: editing?.id && editing.id !== '' ? editing.id : `fab-${Date.now()}`,
        label: label.trim(),
        icon: iconName.trim(),
        href: href.trim(),
      };

      if (editing?.id) {
        setFabIcons(fabIcons.map((i) => (i.id === editing.id ? entry : i)));
        toast({
          variant: 'success',
          title: t('toasts.t016_71326f'),
          description: t('superadmin.icons.saved'),
        });
      } else {
        setFabIcons([...fabIcons, entry]);
        toast({
          variant: 'success',
          title: t('toasts.t015_937bdd'),
          description: t('superadmin.icons.added'),
        });
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmDestructive({
      title: t('superadmin.icons.deleteTitle'),
      message: t('superadmin.icons.deleteConfirm'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('superadmin.actions.delete'),
    });
    if (!ok) return;
    setFabIcons(fabIcons.filter((i) => i.id !== id));
    toast({
      title: t('toasts.t014_3569a8'),
      description: t('superadmin.icons.removed'),
    });
  };

  const header = useMemo(
    () => (
      <View style={{ gap: 10, marginBottom: 8 }}>
        <Title>{t('nav.fabIcons')}</Title>
        <Muted>{t('superadmin.icons.subtitle')}</Muted>
        <Button label={t('superadmin.icons.addIcon')} onPress={openAdd} />
        {isFormOpen ? (
          <Card style={{ gap: 10 }}>
            <Subtitle>
              {editing?.id ? t('superadmin.actions.edit') : t('superadmin.icons.newIcon')}
            </Subtitle>
            <Input
              label={t('superadmin.icons.labelField')}
              value={label}
              onChangeText={setLabel}
            />
            <Input
              label={t('superadmin.icons.iconNameField')}
              value={iconName}
              onChangeText={setIconName}
              ltr
              autoCapitalize="none"
            />
            <Input
              label={t('superadmin.icons.hrefField')}
              value={href}
              onChangeText={setHref}
              ltr
            />
            <View style={styles.formActions}>
              <Button
                label={t('common.save')}
                onPress={save}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={resetForm}
                disabled={saving}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}
      </View>
    ),
    [isFormOpen, editing, label, iconName, href, saving, t, fabIcons]
  );

  return (
    <Screen>
      <FlatList
        data={fabIcons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState title={t('superadmin.icons.empty')} icon="apps-outline" />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: theme.colors.accentSoft },
                ]}
              >
                <Ionicons
                  name={
                    (item.icon in Ionicons.glyphMap
                      ? item.icon
                      : 'ellipse-outline') as keyof typeof Ionicons.glyphMap
                  }
                  size={22}
                  color={theme.colors.accent}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {item.label}
                </Text>
                <Muted>{item.href}</Muted>
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                label={t('superadmin.actions.edit')}
                variant="outline"
                onPress={() => openEdit(item)}
              />
              <Button
                label={t('superadmin.actions.delete')}
                variant="ghost"
                onPress={() => remove(item.id)}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  formActions: { flexDirection: 'row', gap: 8 },
});
