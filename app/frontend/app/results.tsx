import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveScanToDB } from '../src/db';
import Svg, { Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { ArrowLeft, RotateCcw, Baby, Dumbbell, Sparkles, CheckCircle2, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Leaf, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

import { Platform } from 'react-native';

const API_BASE = "https://insideout-vask.onrender.com/api";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function Results() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIngs, setExpandedIngs] = useState<Record<string, boolean>>({});
  
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchScan = async () => {
      try {
        const res = await fetch(`${API_BASE}/scans/${id}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const data = await res.json();
        setScan(data);
        await saveScanToDB(data); // Save to local SQLite Session
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchScan();
  }, [id]);

  useEffect(() => {
    if (scan) {
      Animated.timing(progressAnim, {
        toValue: scan.health_score,
        duration: 1100,
        useNativeDriver: false,
      }).start();
    }
  }, [scan]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.mint} />
      </View>
    );
  }

  if (!scan) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Scan not found</Text>
      </View>
    );
  }

  const overallTheme = theme.colors.status[scan.overall_status as keyof typeof theme.colors.status] || theme.colors.status.safe;
  
  // Decision Guidance
  const getDecisionGuidance = () => {
    if (scan.overall_status === 'risky') return { label: '🔴 AVOID', text: 'Highly processed; linked to inflammation.' };
    if (scan.overall_status === 'caution') return { label: '🟡 LIMIT', text: 'Safe in moderation; spikes blood sugar.' };
    return { label: '✅ GOOD CHOICE', text: 'Clean, nutrient-dense ingredients.' };
  };
  const decision = getDecisionGuidance();

  // Gauge setup
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0]
  });

  const toggleIng = (name: string) => {
    setExpandedIngs(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getSmartIcon = (cat: string) => {
    if (cat === 'kids') return Baby;
    if (cat === 'fitness') return Dumbbell;
    return Sparkles;
  };

  const getSmartTitle = (cat: string) => {
    if (cat === 'kids') return 'Child Safety';
    if (cat === 'fitness') return 'Fitness Impact';
    return 'Skin Sensitivity';
  };

  const getStatusIcon = (status: string, size=20, color: string) => {
    if (status === 'safe') return <CheckCircle2 size={size} color={color} />;
    if (status === 'caution') return <AlertTriangle size={size} color={color} />;
    return <ShieldAlert size={size} color={color} />;
  };

  const counts = scan.ingredients.reduce((acc: any, ing: any) => {
    acc[ing.status] = (acc[ing.status] || 0) + 1;
    return acc;
  }, { safe: 0, caution: 0, risky: 0 });

  return (
    <View style={styles.container} testID="results-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} testID="results-back-btn" style={styles.iconBtn}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis</Text>
        <TouchableOpacity onPress={() => router.replace(`/scan?profile=${scan.profile}`)} testID="rescan-btn" style={styles.iconBtn}>
          <RotateCcw size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
        <View style={styles.titleSection}>
          <Text style={styles.productName} testID="product-name">{scan.product_name}</Text>
          <Text style={styles.metaLine}>{scan.product_category.toUpperCase()} · FOR {scan.profile.toUpperCase()}</Text>
        </View>

        {/* Health Gauge */}
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeGlow, { backgroundColor: overallTheme.glow }]} />
          <Svg width={size} height={size}>
            <Circle
              stroke={theme.colors.border}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            <AnimatedCircle
              stroke={overallTheme.color}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.gaugeCenter}>
            <Text style={[styles.scoreValue, { color: overallTheme.color }]}>{scan.health_score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
            <View style={[styles.statusPill, { backgroundColor: overallTheme.bg }]}>
              <Text style={[styles.statusPillText, { color: overallTheme.color }]}>{scan.overall_status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <BlurView intensity={60} tint="light" style={styles.summaryCard}>
          <Text style={styles.summaryText}>{scan.summary}</Text>
        </BlurView>

        {/* GUIDED DECISION */}
        <View style={[styles.decisionCard, { borderColor: overallTheme.color }]}>
          <Text style={styles.decisionLabel}>{decision.label}</Text>
          <Text style={styles.decisionText}>{decision.text}</Text>
        </View>

        {/* Traffic Light */}
        <View style={styles.trafficLightContainer}>
          {['safe', 'caution', 'risky'].map((status) => {
            const stheme = theme.colors.status[status as keyof typeof theme.colors.status];
            return (
              <View key={status} style={[styles.trafficRow, { backgroundColor: stheme.bg }]}>
                <View style={styles.trafficLeft}>
                  <View style={[styles.trafficDot, { backgroundColor: stheme.color }]} />
                  <Text style={styles.trafficLabel}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </View>
                <Text style={[styles.trafficCount, { color: stheme.color }]}>{counts[status]}</Text>
              </View>
            );
          })}
        </View>

        {/* Smart Cards */}
        <View style={styles.smartCardsContainer}>
          {scan.categories.map((cat: any) => {
            const SmartIcon = getSmartIcon(cat.category);
            const stheme = theme.colors.status[cat.status as keyof typeof theme.colors.status];
            return (
              <View key={cat.category} style={styles.smartCard} testID={`smart-${cat.category}`}>
                <View style={styles.smartHeader}>
                  <View style={[styles.smartIconWrap, { backgroundColor: stheme.bg }]}>
                    <SmartIcon size={20} color={stheme.color} />
                  </View>
                  <View style={styles.smartTitleWrap}>
                    <Text style={styles.smartTitle}>{getSmartTitle(cat.category)}</Text>
                    <Text style={styles.smartHeadline}>{cat.headline}</Text>
                  </View>
                  <View style={[styles.smartScoreBadge, { backgroundColor: stheme.color }]}>
                    <Text style={styles.smartScoreText}>{cat.score}</Text>
                  </View>
                </View>
                {cat.flagged.length > 0 && (
                  <View style={styles.chipRow}>
                    {cat.flagged.map((f: string, i: number) => (
                      <View key={i} style={[styles.chip, { backgroundColor: stheme.bg }]}>
                        <Text style={[styles.chipText, { color: stheme.color }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Ingredients Breakdown */}
        <Text style={styles.sectionTitle}>Ingredient Breakdown</Text>
        <View style={styles.ingList} testID="ingredient-list">
          {scan.ingredients.map((ing: any) => {
            const stheme = theme.colors.status[ing.status as keyof typeof theme.colors.status];
            const isExpanded = expandedIngs[ing.name];
            return (
              <TouchableOpacity 
                key={ing.name} 
                style={styles.ingRow} 
                onPress={() => toggleIng(ing.name)}
                testID={`ingredient-row-${ing.name.replace(/\s+/g, '-')}`}
              >
                <View style={styles.ingHeader}>
                  <View style={styles.ingIconName}>
                    {getStatusIcon(ing.status, 20, stheme.color)}
                    <Text style={styles.ingName}>{ing.name}</Text>
                  </View>
                  {isExpanded ? <ChevronUp size={20} color={theme.colors.textMuted} /> : <ChevronDown size={20} color={theme.colors.textMuted} />}
                </View>
                {isExpanded && (
                  <View style={styles.ingDetails}>
                    <Text style={styles.ingPlain}>{ing.plain}</Text>
                    <Text style={styles.ingCitation}>Source: {ing.citation}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Better Alternatives */}
        {scan.alternatives && scan.alternatives.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Better Alternatives</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.altScroll}>
              {scan.alternatives.map((alt: any, idx: number) => (
                <View key={idx} style={styles.altCard} testID={`alt-${idx}`}>
                  <View style={styles.altIconWrap}>
                    <Leaf size={24} color={theme.colors.mint} />
                  </View>
                  <Text style={styles.altName} numberOfLines={2}>{alt.name}</Text>
                  <Text style={styles.altReason} numberOfLines={2}>{alt.reason}</Text>
                  <View style={styles.altWhereRow}>
                    <MapPin size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.altWhere}>Amazon / iHerb</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.xaiFooter}>
          Every claim above is cross-referenced with WHO Guidelines & FDA Regulations. InsideOut KB v1.0.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { ...theme.typography.body, color: theme.colors.status.risky.color },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bg, zIndex: 10,
  },
  headerTitle: { ...theme.typography.subheading, fontSize: 18 },
  iconBtn: { padding: 8 },

  content: { padding: theme.spacing.lg },

  titleSection: { alignItems: 'center', marginBottom: theme.spacing.xl },
  productName: { ...theme.typography.heading, fontSize: 24, textAlign: 'center', marginBottom: 4 },
  metaLine: { ...theme.typography.caption, fontSize: 12, fontWeight: '700' },

  gaugeContainer: { alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: theme.spacing.xl },
  gaugeGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, filter: 'blur(30px)', opacity: 0.5 },
  gaugeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { ...theme.typography.heading, fontSize: 56, lineHeight: 60 },
  scoreMax: { ...theme.typography.caption, fontSize: 16, marginTop: -8, marginBottom: 4 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radii.badge },
  statusPillText: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  summaryCard: {
    padding: theme.spacing.md, borderRadius: theme.radii.card,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  summaryText: { ...theme.typography.subheading, fontSize: 16, textAlign: 'center' },

  decisionCard: {
    padding: theme.spacing.md, borderRadius: theme.radii.card,
    borderWidth: 2, marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface, alignItems: 'center'
  },
  decisionLabel: { ...theme.typography.heading, fontSize: 18, marginBottom: 4 },
  decisionText: { ...theme.typography.body, fontSize: 14, textAlign: 'center' },

  trafficLightContainer: { marginBottom: theme.spacing.xl, gap: 8 },
  trafficRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.button,
  },
  trafficLeft: { flexDirection: 'row', alignItems: 'center' },
  trafficDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  trafficLabel: { ...theme.typography.subheading, fontSize: 16 },
  trafficCount: { ...theme.typography.heading, fontSize: 20 },

  smartCardsContainer: { gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  smartCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  smartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  smartIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  smartTitleWrap: { flex: 1 },
  smartTitle: { ...theme.typography.caption, fontSize: 12, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  smartHeadline: { ...theme.typography.subheading, fontSize: 16 },
  smartScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.badge },
  smartScoreText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.badge },
  chipText: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { ...theme.typography.heading, fontSize: 20, marginBottom: theme.spacing.md },
  
  ingList: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
    marginBottom: theme.spacing.xl,
  },
  ingRow: { padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  ingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ingIconName: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  ingName: { ...theme.typography.subheading, fontSize: 16, marginLeft: 12, flex: 1 },
  ingDetails: { marginTop: theme.spacing.sm, paddingLeft: 32 },
  ingPlain: { ...theme.typography.body, fontSize: 14, marginBottom: 4 },
  ingCitation: { ...theme.typography.caption, fontSize: 12, fontStyle: 'italic' },

  altScroll: { gap: theme.spacing.md, paddingRight: theme.spacing.lg, marginBottom: theme.spacing.xl },
  altCard: {
    width: 200, backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  altIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.mintSoft,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  altName: { ...theme.typography.subheading, fontSize: 16, marginBottom: 4 },
  altReason: { ...theme.typography.body, fontSize: 14, marginBottom: 12, flex: 1 },
  altWhereRow: { flexDirection: 'row', alignItems: 'center' },
  altWhere: { ...theme.typography.caption, fontSize: 12, marginLeft: 4 },

  xaiFooter: { ...theme.typography.caption, fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: theme.spacing.md },
});
