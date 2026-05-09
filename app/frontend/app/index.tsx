import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { initDB, getTodayScans } from '../src/db';
import { BlurView } from 'expo-blur';
import { ShieldCheck, History, User, Baby, Dumbbell, Sparkles, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const [todayScans, setTodayScans] = React.useState<any[]>([]);

  useEffect(() => {
    initDB();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      getTodayScans().then(setTodayScans);
    }, [])
  );

  const totalScans = todayScans.length;
  let totalRisky = 0, totalSafe = 0;
  let healthySwaps: any[] = [];
  let avgHealthScore = 0;

  if (totalScans > 0) {
    let sumScore = 0;
    todayScans.forEach((scan: any) => {
      sumScore += scan.health_score;
      totalRisky += (scan.risky_count || 0);
      totalSafe += (scan.safe_count || 0);
      try {
        const alts = JSON.parse(scan.alternatives_json || '[]');
        if (alts.length > 0) {
           healthySwaps.push({ product: scan.product_name, alts });
        }
      } catch(e) {}
    });
    avgHealthScore = Math.round(sumScore / totalScans);
  }

  const riskyPercent = (totalRisky + totalSafe) > 0 ? Math.round((totalRisky / (totalRisky + totalSafe)) * 100) : 0;
  const safePercent = (totalRisky + totalSafe) > 0 ? Math.round((totalSafe / (totalRisky + totalSafe)) * 100) : 0;

  const profiles = [
    {
      id: 'default',
      title: 'Default Profile',
      desc: 'General health & safety analysis',
      Icon: User,
      color: '#64748B',
      testId: 'profile-default-btn',
    },
    {
      id: 'parent',
      title: 'Parent (Kids)',
      desc: 'Strict screening for children',
      Icon: Baby,
      color: '#F59E0B',
      testId: 'profile-parent-btn',
    },
    {
      id: 'athlete',
      title: 'Athlete (Fitness)',
      desc: 'Optimize for sports nutrition',
      Icon: Dumbbell,
      color: '#0EA5E9',
      testId: 'profile-athlete-btn',
    },
    {
      id: 'sensitive_skin',
      title: 'Sensitive Skin',
      desc: 'Flag harsh chemicals & allergens',
      Icon: Sparkles,
      color: '#EC4899',
      testId: 'profile-sensitive_skin-btn',
    },
  ];

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl }]}
      testID="home-screen"
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Animated.View style={[styles.shieldRing, { transform: [{ scale: pulseAnim }] }]}>
            <ShieldCheck size={28} color={theme.colors.mint} />
          </Animated.View>
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>InsideOut</Text>
            <Text style={styles.brandTagline}>Because what's inside matters.</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.historyBtn} 
          onPress={() => router.push('/history')}
          testID="open-history-btn"
        >
          <History size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <BlurView intensity={80} tint="light" style={styles.heroCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI Safety Scanner</Text>
        </View>
        <Text style={styles.heroTitle}>Scan any product.{'\n'}Know what's inside.</Text>
        <Text style={styles.heroSubtitle}>Instantly cross-reference ingredients with global health databases.</Text>
      </BlurView>

      {/* TODAY'S SHOPPING IMPACT */}
      {totalScans > 0 && (
        <View style={styles.dashboardCard}>
          <Text style={styles.sectionTitle}>Today's Shopping Impact</Text>
          <View style={styles.dashboardRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg Score</Text>
              <Text style={[styles.statValue, { color: avgHealthScore >= 75 ? theme.colors.status.safe.color : theme.colors.status.risky.color }]}>{avgHealthScore}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Safe vs Risky</Text>
              <Text style={styles.statValue}>{safePercent}% / {riskyPercent}%</Text>
            </View>
          </View>
          {healthySwaps.length > 0 && (
            <View style={styles.swapsBox}>
              <Text style={styles.swapsTitle}>Healthy Swaps Recommended:</Text>
              {healthySwaps.slice(0, 3).map((swap, idx) => (
                <Text key={idx} style={styles.swapText} numberOfLines={1}>
                  • Instead of <Text style={{fontWeight: '700'}}>{swap.product}</Text>, try: {swap.alts[0]?.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Who are we analyzing for?</Text>

      <View style={styles.profilesGrid}>
        {profiles.map((p) => (
          <TouchableOpacity 
            key={p.id} 
            style={styles.profileCard}
            onPress={() => router.push(`/scan?profile=${p.id}`)}
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

      <Text style={styles.footerText}>
        Powered by Gemini Vision · Citations: WHO Guidelines & FDA Regulations
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.mintSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.mint,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    ...theme.typography.heading,
    fontSize: 22,
  },
  brandTagline: {
    ...theme.typography.caption,
    fontSize: 12,
  },
  historyBtn: {
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.badge,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.glass,
    overflow: 'hidden',
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.mintSoft,
    borderRadius: theme.radii.badge,
    marginBottom: theme.spacing.md,
  },
  badgeText: {
    color: theme.colors.mint,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...theme.typography.heading,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: theme.spacing.sm,
  },
  heroSubtitle: {
    ...theme.typography.body,
    fontSize: 16,
    lineHeight: 22,
  },
  dashboardCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.lg, marginBottom: theme.spacing.xl,
    borderWidth: 1, borderColor: theme.colors.border
  },
  dashboardRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  statBox: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.md, borderRadius: theme.radii.button, alignItems: 'center' },
  statLabel: { ...theme.typography.caption, fontSize: 12, marginBottom: 4 },
  statValue: { ...theme.typography.heading, fontSize: 24, color: theme.colors.textPrimary },
  swapsBox: { backgroundColor: theme.colors.status.safe.bg, padding: theme.spacing.md, borderRadius: theme.radii.badge },
  swapsTitle: { ...theme.typography.subheading, fontSize: 14, color: theme.colors.status.safe.color, marginBottom: 4 },
  swapText: { ...theme.typography.body, fontSize: 12, color: theme.colors.textPrimary, marginBottom: 2 },
  sectionTitle: {
    ...theme.typography.subheading,
    fontSize: 20,
    marginBottom: theme.spacing.md,
  },
  profilesGrid: {
    flexDirection: 'column',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  profileTitle: {
    ...theme.typography.subheading,
    fontSize: 18,
    marginBottom: 4,
  },
  profileDesc: {
    ...theme.typography.body,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  scanCta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanCtaText: {
    fontWeight: '700',
    color: theme.colors.mint,
    marginRight: 4,
    fontSize: 14,
  },
  footerText: {
    ...theme.typography.caption,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
