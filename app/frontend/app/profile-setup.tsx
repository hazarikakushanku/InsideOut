import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User, Plus, Check, Trash2 } from 'lucide-react-native';
import { theme } from '../src/theme';

const API_BASE = "https://insideout-vask.onrender.com/api";

const CONDITIONS = [
  { id: 'diabetes', label: '🩸 Diabetes', desc: 'Flags sugar, glucose, sweeteners' },
  { id: 'hypertension', label: '💔 Hypertension', desc: 'Flags salt, sodium, MSG' },
  { id: 'heart_disease', label: '❤️ Heart Disease', desc: 'Flags saturated fat, palm oil' },
  { id: 'gluten_intolerance', label: '🌾 Gluten Intolerance', desc: 'Flags wheat, barley, malt' },
  { id: 'nut_allergy', label: '🥜 Nut Allergy', desc: 'Flags all nut derivatives' },
  { id: 'lactose_intolerance', label: '🥛 Lactose Intolerance', desc: 'Flags milk, whey, casein' },
];

export default function ProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this profile.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/user-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), conditions: selected, allergies: [] }),
      });
      if (!res.ok) throw new Error('Failed to save');
      Alert.alert('✅ Profile Saved!', `"${name}" has been created successfully.`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Health Profile</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Profile Name</Text>
          <View style={styles.inputRow}>
            <User size={20} color={theme.colors.mint} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Dad, Mom, Baby Riya..."
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={30}
            />
          </View>
        </View>

        {/* Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Health Conditions</Text>
          <Text style={styles.sectionDesc}>Select all that apply. We'll flag harmful ingredients automatically.</Text>
          {CONDITIONS.map(c => {
            const active = selected.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.conditionCard, active && styles.conditionCardActive]}
                onPress={() => toggle(c.id)}
                testID={`condition-${c.id}`}
              >
                <View style={styles.conditionLeft}>
                  <Text style={styles.conditionLabel}>{c.label}</Text>
                  <Text style={styles.conditionDesc}>{c.desc}</Text>
                </View>
                <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                  {active && <Check size={16} color="#FFF" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
          testID="save-profile-btn"
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Plus size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Create Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { ...theme.typography.subheading, fontSize: 18 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { padding: theme.spacing.lg },
  section: { marginBottom: theme.spacing.xl },
  sectionLabel: { ...theme.typography.subheading, fontSize: 16, marginBottom: 8 },
  sectionDesc: { ...theme.typography.body, fontSize: 14, marginBottom: theme.spacing.md },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.button,
    paddingHorizontal: theme.spacing.md, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  input: { flex: 1, ...theme.typography.body, fontSize: 16, color: theme.colors.textPrimary },
  conditionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.md, marginBottom: theme.spacing.sm,
    borderWidth: 2, borderColor: theme.colors.border,
  },
  conditionCardActive: { borderColor: theme.colors.mint, backgroundColor: theme.colors.mintSoft },
  conditionLeft: { flex: 1 },
  conditionLabel: { ...theme.typography.subheading, fontSize: 16, marginBottom: 2 },
  conditionDesc: { ...theme.typography.body, fontSize: 13 },
  checkBox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: theme.colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkBoxActive: { backgroundColor: theme.colors.mint, borderColor: theme.colors.mint },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.mint, borderRadius: theme.radii.button,
    paddingVertical: 18, marginTop: theme.spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
});
