import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { initDB, getTodayScans } from '../src/db';
import { BlurView } from 'expo-blur';
import { ShieldCheck, History, User, Baby, Dumbbell, Sparkles, ArrowRight, Plus, Trash2, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

const API_BASE = "https://insideout-vask.onrender.com/api";

const SCAN_PROFILES = [
  { id: 'default', title: 'Default', desc: 'General health analysis', Icon: User, color: '#64748B', testId: 'profile-default-btn' },
  { id: 'parent', title: 'Parent (Kids)', desc: 'Strict screening for children', Icon: Baby, color: '#F59E0B', testId: 'profile-parent-btn' },
  { id: 'athlete', title: 'Athlete', desc: 'Optimize for sports nutrition', Icon: Dumbbell, color: '#0EA5E9', testId: 'profile-athlete-btn' },
  { id: 'sensitive_skin', title: 'Sensitive Skin', desc: 'Flag harsh chemicals', Icon: Sparkles, color: '#EC4899', testId: 'profile-sensitive_skin-btn' },
];

const CONDITION_COLORS: Record<string, string> = {
  diabetes: '#F59E0B', hypertension: '#EF4444', heart_disease: '#EC4899',
  gluten_intolerance: '#D97706', nut_allergy: '#78350F', lactose_intolerance: '#60A5FA',
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [todayScans, setTodayScans] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    initDB();
    fetchUserProfiles();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getTodayScans().then(setTodayScans);
      fetchUserProfiles();
    }, [])
  );

  const fetchUserProfiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/user-profiles`);
      const data = await res.json();
      setUserProfiles(data || []);
    } catch (e) {}
  };

  const deleteProfile = async (id: string) => {
    try {
      await fetch(`${API_BASE}/user-profiles/${id}`, { method: 'DELETE' });
      setUserProfiles(prev => prev.filter(p => p.id !== id));
      if (selectedProfileId === id) setSelectedProfileId(null);
    } catch (e) {}
  };

  const totalScans = todayScans.length;
  let totalRisky = 0, totalSafe = 0, sumScore = 0;
  todayScans.forEach((scan: any) => {
    sumScore += scan.health_score;
    totalRisky += (scan.risky_count || 0);
    totalSafe += (scan.safe_count || 0);
  });
  const avgHealthScore = totalScans > 0 ? Math.round(sumScore / totalScans) : 0;

  const selectedProfile = userProfiles.find(p => p.id === selectedProfileId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl }]}
      testID="home-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Animated.View style={[styles.shieldRing, { transform: [{ scale: pulseAnim }] }]}>
            <ShieldCheck size={28} color={theme.colors.mint} />
          </Animated.View>
          <View>
            <Text style={styles.brandTitle}>InsideOut</Text>
            <Text style={styles.brandTagline}>Because what's inside matters.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/history')} testID="open-history-btn">
          <History size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Hero Card */}
      <BlurView intensity={80} tint="light" style={styles.heroCard}>
        <View style={styles.badge}><Text style={styles.badgeText}>AI Safety Scanner v2</Text></View>
        <Text style={styles.heroTitle}>Scan any product.{'\n'}Know what's inside.</Text>
        <Text style={styles.heroSubtitle}>Barcode scanning · E-code decoding · Personalized health alerts</Text>
      </BlurView>

      {/* ── HEALTH PROFILES SECTION ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Health Profiles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/profile-setup')} testID="add-profile-btn">
          <Plus size={18} color={theme.colors.mint} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {userProfiles.length === 0 ? (
        <TouchableOpacity style={styles.emptyProfileCard} onPress={() => router.push('/profile-setup')}>
          <Plus size={24} color={theme.colors.mint} />
          <Text style={styles.emptyProfileText}>Add a health profile (Diabetes, Hypertension, etc.) for personalized alerts</Text>
          <ChevronRight size={20} color={theme.colors.mint} />
        </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileScroll}>
          {userProfiles.map(p => {
            const isSelected = selectedProfileId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.profileChip, isSelected && styles.profileChipActive]}
                onPress={() => setSelectedProfileId(isSelected ? null : p.id)}
                testID={`user-profile-${p.id}`}
              >
                <Text style={[styles.profileChipName, isSelected && { color: '#FFF' }]}>{p.name}</Text>
                <View style={styles.conditionTagsRow}>
                  {(p.conditions || []).slice(0, 3).map((c: string) => (
                    <View key={c} style={[styles.conditionDot, { backgroundColor: CONDITION_COLORS[c] || '#888' }]} />
                  ))}
                </View>
                {isSelected && (
                  <TouchableOpacity onPress={() => deleteProfile(p.id)} style={styles.deleteBtn}>
                    <Trash2 size={14} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addProfileChip} onPress={() => router.push('/profile-setup')}>
            <Plus size={20} color={theme.colors.mint} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Active profile info */}
      {selectedProfile && (
        <View style={styles.activeProfileCard}>
          <Text style={styles.activeProfileName}>📋 Scanning for: {selectedProfile.name}</Text>
          <View style={styles.conditionsList}>
            {(selectedProfile.conditions || []).map((c: string) => (
              <View key={c} style={[styles.conditionTag, { backgroundColor: `${CONDITION_COLORS[c]}20`, borderColor: CONDITION_COLORS[c] }]}>
                <Text style={[styles.conditionTagText, { color: CONDITION_COLORS[c] }]}>{c.replace(/_/g, ' ').toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Today's Impact */}
      {totalScans > 0 && (
        <View style={styles.dashboardCard}>
          <Text style={styles.sectionTitle}>Today's Shopping Impact</Text>
          <View style={styles.dashboardRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg Score</Text>
              <Text style={[styles.statValue, { color: avgHealthScore >= 75 ? theme.colors.status.safe.color : theme.colors.status.risky.color }]}>{avgHealthScore}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Scans Today</Text>
              <Text style={styles.statValue}>{totalScans}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Scan Profiles */}
      <Text style={[styles.sectionTitle, { marginTop: theme.spacing.md }]}>Scan for Profile</Text>
      <View style={styles.profilesGrid}>
        {SCAN_PROFILES.map((p) => (
          <TouchableOpacity
            key={p.id} style={styles.profileCard}
            onPress={() => router.push(`/scan?profile=${p.id}&user_profile_id=${selectedProfileId || ''}`)}
            testID={p.testId}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${p.color}20` }]}>
              <p.Icon size={28} color={p.color} />
            </View>
            <Text style={styles.profileTitle}>{p.title}</Text>
            <Text style={styles.profileDesc}>{p.desc}</Text>
            <View style={styles.scanCta}>
              <Text style={styles.scanCtaText}>Scan</Text>
              <ArrowRight size={16} color={theme.colors.mint} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footerText}>Powered by Gemini Vision · Open Food Facts · WHO & FDA cross-reference</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingHorizontal: theme.spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  shieldRing: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.mintSoft,
    justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.sm,
    borderWidth: 2, borderColor: theme.colors.mint,
  },
  brandTitle: { ...theme.typography.heading, fontSize: 22 },
  brandTagline: { ...theme.typography.caption, fontSize: 12 },
  historyBtn: {
    padding: theme.spacing.xs, backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.badge, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  heroCard: {
    padding: theme.spacing.lg, borderRadius: theme.radii.card,
    backgroundColor: theme.colors.glass, overflow: 'hidden',
    marginBottom: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border,
  },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
    backgroundColor: theme.colors.mintSoft, borderRadius: theme.radii.badge, marginBottom: theme.spacing.md,
  },
  badgeText: { color: theme.colors.mint, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  heroTitle: { ...theme.typography.heading, fontSize: 28, lineHeight: 34, marginBottom: theme.spacing.sm },
  heroSubtitle: { ...theme.typography.body, fontSize: 14, lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sectionTitle: { ...theme.typography.subheading, fontSize: 18, marginBottom: theme.spacing.md },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: theme.colors.mint, fontWeight: '700', fontSize: 14 },
  emptyProfileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.mintSoft, borderRadius: theme.radii.card,
    padding: theme.spacing.md, marginBottom: theme.spacing.xl,
    borderWidth: 1, borderColor: theme.colors.mint, borderStyle: 'dashed',
  },
  emptyProfileText: { ...theme.typography.body, fontSize: 14, flex: 1, color: theme.colors.mint },
  profileScroll: { gap: theme.spacing.sm, paddingRight: theme.spacing.lg, marginBottom: theme.spacing.md },
  profileChip: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, minWidth: 120,
  },
  profileChipActive: { backgroundColor: theme.colors.mint, borderColor: theme.colors.mint },
  profileChipName: { ...theme.typography.subheading, fontSize: 15, marginBottom: 6 },
  conditionTagsRow: { flexDirection: 'row', gap: 4 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  deleteBtn: { marginTop: 8, alignSelf: 'flex-start' },
  addProfileChip: {
    width: 56, height: 56, borderRadius: theme.radii.card, backgroundColor: theme.colors.mintSoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.mint,
    borderStyle: 'dashed', alignSelf: 'center',
  },
  activeProfileCard: {
    backgroundColor: theme.colors.mintSoft, borderRadius: theme.radii.card,
    padding: theme.spacing.md, marginBottom: theme.spacing.xl,
    borderWidth: 1, borderColor: theme.colors.mint,
  },
  activeProfileName: { ...theme.typography.subheading, fontSize: 15, marginBottom: 8 },
  conditionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conditionTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.badge, borderWidth: 1 },
  conditionTagText: { fontSize: 11, fontWeight: '700' },
  dashboardCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.lg, marginBottom: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border,
  },
  dashboardRow: { flexDirection: 'row', gap: theme.spacing.md },
  statBox: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.md, borderRadius: theme.radii.button, alignItems: 'center' },
  statLabel: { ...theme.typography.caption, fontSize: 12, marginBottom: 4 },
  statValue: { ...theme.typography.heading, fontSize: 28, color: theme.colors.textPrimary },
  profilesGrid: { flexDirection: 'column', gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  profileCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  iconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.md },
  profileTitle: { ...theme.typography.subheading, fontSize: 18, marginBottom: 4 },
  profileDesc: { ...theme.typography.body, fontSize: 14, marginBottom: theme.spacing.md },
  scanCta: { flexDirection: 'row', alignItems: 'center' },
  scanCtaText: { fontWeight: '700', color: theme.colors.mint, marginRight: 4, fontSize: 14 },
  footerText: { ...theme.typography.caption, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: theme.spacing.sm },
});
