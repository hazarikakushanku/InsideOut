import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { History as HistoryIcon, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'web' 
  ? "http://localhost:8000/api" 
  : "https://pretemperately-unwakening-nathalie.ngrok-free.dev/api";

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScans = async () => {
    try {
      const res = await fetch(`${API_BASE}/scans?limit=30`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setScans(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchScans();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchScans();
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <HistoryIcon size={40} color={theme.colors.mint} />
        </View>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptyDesc}>Scan a product to start building your safety history.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/')} testID="empty-scan-btn">
          <Text style={styles.emptyBtnText}>Start a Scan</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const stheme = theme.colors.status[item.overall_status as keyof typeof theme.colors.status] || theme.colors.status.safe;
    const dateStr = new Date(item.created_at).toLocaleDateString();

    return (
      <TouchableOpacity 
        style={styles.row} 
        onPress={() => router.push(`/results?id=${item.id}`)}
        testID={`history-item-${item.id}`}
      >
        <View style={[styles.scoreCircle, { backgroundColor: stheme.bg }]}>
          <Text style={[styles.scoreText, { color: stheme.color }]}>{item.health_score}</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.product_name}</Text>
          <Text style={styles.rowMeta}>{item.product_category.toUpperCase()} · {item.profile} · {dateStr}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: stheme.bg }]}>
          <Text style={[styles.statusPillText, { color: stheme.color }]}>{item.overall_status.toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container} testID="history-screen">
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} testID="history-back-btn" style={styles.iconBtn}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan History</Text>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      {loading && scans.length === 0 ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color={theme.colors.mint} />
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + theme.spacing.xl }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.mint} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { ...theme.typography.subheading, fontSize: 18 },
  iconBtn: { padding: 8 },
  iconBtnPlaceholder: { width: 40 },

  listContent: { padding: theme.spacing.lg },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.mintSoft,
    justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.lg,
  },
  emptyTitle: { ...theme.typography.heading, fontSize: 24, marginBottom: 8 },
  emptyDesc: { ...theme.typography.body, textAlign: 'center', marginBottom: theme.spacing.xl, paddingHorizontal: 40 },
  emptyBtn: {
    backgroundColor: theme.colors.mint, paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: theme.radii.button,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.card, marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  scoreCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md,
  },
  scoreText: { fontWeight: '800', fontSize: 18 },
  rowContent: { flex: 1, marginRight: theme.spacing.md },
  rowTitle: { ...theme.typography.subheading, fontSize: 16, marginBottom: 4 },
  rowMeta: { ...theme.typography.caption, fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.badge },
  statusPillText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },
});
