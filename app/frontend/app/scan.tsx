import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ActivityIndicator, Alert, Vibration, Platform
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { ArrowLeft, Zap, ZapOff, Image as ImageIcon, Camera, Barcode, Upload } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../src/theme';

const API_BASE = "https://insideout-vask.onrender.com/api";

type ScanMode = 'camera' | 'barcode';

// ─── WEB SCAN SCREEN ─────────────────────────────────────────────────────────
function WebScanScreen() {
  const router = useRouter();
  const { profile, user_profile_id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [analyzing, setAnalyzing] = useState(false);
  const [stageText, setStageText] = useState('Extracting ingredients...');
  const fileInputRef = useRef<any>(null);
  const cameraInputRef = useRef<any>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzing) {
      const stages = ["Extracting ingredients...", "Cross-referencing hazards...", "Generating health report..."];
      let i = 0;
      setStageText(stages[0]);
      interval = setInterval(() => {
        i = (i + 1) % stages.length;
        setStageText(stages[i]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [analyzing]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        const res = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            profile: profile || 'default',
            product_category: 'default',
            user_profile_id: user_profile_id || null,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Analysis failed (${res.status}): ${errText.substring(0, 200)}`);
        }
        const data = await res.json();
        router.replace(`/results?id=${data.id}`);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setAnalyzing(false);
    }
  };

  const onFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <View style={[styles.webContainer, { paddingTop: insets.top }]}>
      <View style={styles.webHeader}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.webHeaderTitle}>Scan Product</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.webContent}>
        <View style={styles.webHero}>
          <View style={styles.webIconRing}>
            <Camera size={48} color={theme.colors.mint} />
          </View>
          <Text style={styles.webTitle}>Scan Your Product</Text>
          <Text style={styles.webSubtitle}>
            Take a photo of the ingredients label or upload an image from your gallery.
          </Text>
        </View>

        {/* Hidden file inputs */}
        {Platform.OS === 'web' && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </>
        )}

        <View style={styles.webBtnGroup}>
          {/* Camera button — opens device camera directly */}
          <TouchableOpacity
            style={styles.webCameraBtn}
            onPress={() => (cameraInputRef.current as any)?.click()}
            testID="web-camera-btn"
          >
            <Camera size={28} color="#FFF" />
            <Text style={styles.webCameraBtnText}>Open Camera</Text>
            <Text style={styles.webCameraBtnSub}>Point at the ingredients label</Text>
          </TouchableOpacity>

          {/* Upload button */}
          <TouchableOpacity
            style={styles.webUploadBtn}
            onPress={() => (fileInputRef.current as any)?.click()}
            testID="web-upload-btn"
          >
            <Upload size={22} color={theme.colors.mint} />
            <Text style={styles.webUploadBtnText}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webTipCard}>
          <Text style={styles.webTipTitle}>📸 Tips for best results</Text>
          <Text style={styles.webTip}>• Hold the product steady under good light</Text>
          <Text style={styles.webTip}>• Make sure the full ingredient list is visible</Text>
          <Text style={styles.webTip}>• Tap the ingredients text to focus before capturing</Text>
        </View>
      </View>

      {/* Analyzing Overlay */}
      {analyzing && (
        <View style={[StyleSheet.absoluteFillObject, styles.analyzingOverlay]}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.mint} />
            <Text style={styles.analyzingTitle}>Analyzing...</Text>
            <Text style={styles.analyzingStage}>{stageText}</Text>
            <Text style={styles.analyzingFooter}>WHO + FDA cross-reference</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── NATIVE SCAN SCREEN ───────────────────────────────────────────────────────
export default function Scan() {
  if (Platform.OS === 'web') return <WebScanScreen />;

  const router = useRouter();
  const { profile, user_profile_id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stageText, setStageText] = useState('Preprocessing image...');
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [barcodeDetected, setBarcodeDetected] = useState<string | null>(null);
  const [barcodeProcessing, setBarcodeProcessing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const lastBarcodeRef = useRef<string | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 236, duration: 900, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [scanLineAnim]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzing) {
      const stages = ["Preprocessing image...", "Extracting ingredients...", "Cross-referencing hazards...", "Generating report..."];
      let i = 0;
      setStageText(stages[0]);
      interval = setInterval(() => {
        i = (i + 1) % stages.length;
        setStageText(stages[i]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [analyzing]);

  const handleAnalyze = async (base64: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          profile: profile || 'default',
          product_category: 'default',
          user_profile_id: user_profile_id || null,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Analysis failed (${res.status}): ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      router.replace(`/results?id=${data.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
      setAnalyzing(false);
    }
  };

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    const code = result.data;
    if (barcodeProcessing || lastBarcodeRef.current === code) return;
    lastBarcodeRef.current = code;
    setBarcodeDetected(code);
    setBarcodeProcessing(true);
    Vibration.vibrate(100);

    try {
      const res = await fetch(`${API_BASE}/barcode/${code}`);
      if (!res.ok) throw new Error('Product not found in database');
      const productData = await res.json();

      Alert.alert(
        `📦 ${productData.product_name || 'Product Found'}`,
        `Brand: ${productData.brand || 'Unknown'}\nBarcode: ${code}\n\nAnalyze this product?`,
        [
          {
            text: 'Cancel', style: 'cancel',
            onPress: () => { setBarcodeProcessing(false); lastBarcodeRef.current = null; setBarcodeDetected(null); }
          },
          {
            text: 'Analyze ✅',
            onPress: async () => {
              setAnalyzing(true);
              try {
                const analyzeRes = await fetch(`${API_BASE}/analyze-barcode`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    barcode: code, profile: profile || 'default',
                    user_profile_id: user_profile_id || null, product_data: productData,
                  }),
                });
                if (!analyzeRes.ok) throw new Error('Analysis failed');
                const data = await analyzeRes.json();
                router.replace(`/results?id=${data.id}`);
              } catch (e: any) {
                Alert.alert('Error', e.message);
                setAnalyzing(false);
              }
            }
          }
        ]
      );
    } catch (e: any) {
      Alert.alert('Not Found', `Barcode ${code} not in Open Food Facts. Try scanning the label instead.`, [
        { text: 'OK', onPress: () => { setBarcodeProcessing(false); lastBarcodeRef.current = null; setBarcodeDetected(null); } }
      ]);
    }
  }, [barcodeProcessing, profile, user_profile_id]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const photo = await cameraRef.current.takePictureAsync({ quality: 1.0, base64: true });
      if (photo?.base64) await handleAnalyze(photo.base64);
    } catch (e) {
      console.log('Camera error:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1.0, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      await handleAnalyze(result.assets[0].base64);
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]} testID="camera-perm-screen">
        <View style={styles.permCard}>
          <View style={styles.permIconContainer}>
            <Camera size={32} color={theme.colors.mint} />
          </View>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>InsideOut needs camera access to scan product labels.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} testID="camera-grant-btn">
            <Text style={styles.primaryBtnText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage} testID="gallery-fallback-btn">
            <Text style={styles.secondaryBtnText}>Use Gallery Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="scan-screen">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        ref={cameraRef}
        onBarcodeScanned={scanMode === 'barcode' ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'] }}
      />

      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />

      {/* Scan Frame */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', height: 240 }}>
          <View style={{ flex: 1 }} />
          <View style={[styles.cutout, scanMode === 'barcode' && styles.cutoutBarcode]}>
            <View style={[styles.bracket, styles.bracketTL, scanMode === 'barcode' && { borderColor: '#60A5FA' }]} />
            <View style={[styles.bracket, styles.bracketTR, scanMode === 'barcode' && { borderColor: '#60A5FA' }]} />
            <View style={[styles.bracket, styles.bracketBL, scanMode === 'barcode' && { borderColor: '#60A5FA' }]} />
            <View style={[styles.bracket, styles.bracketBR, scanMode === 'barcode' && { borderColor: '#60A5FA' }]} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }], backgroundColor: scanMode === 'barcode' ? '#60A5FA' : theme.colors.mint }]} />
          </View>
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ flex: 1 }} />
      </View>

      {barcodeDetected && (
        <View style={styles.barcodeFoundBadge}>
          <Text style={styles.barcodeFoundText}>📦 {barcodeDetected}</Text>
        </View>
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, scanMode === 'camera' && styles.modeBtnActive]}
            onPress={() => { setScanMode('camera'); setBarcodeDetected(null); lastBarcodeRef.current = null; }}
          >
            <Camera size={15} color={scanMode === 'camera' ? '#FFF' : 'rgba(255,255,255,0.6)'} />
            <Text style={[styles.modeBtnText, scanMode === 'camera' && { color: '#FFF' }]}>Label</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, scanMode === 'barcode' && styles.modeBtnActiveBlue]}
            onPress={() => { setScanMode('barcode'); setBarcodeDetected(null); lastBarcodeRef.current = null; }}
          >
            <Barcode size={15} color={scanMode === 'barcode' ? '#FFF' : 'rgba(255,255,255,0.6)'} />
            <Text style={[styles.modeBtnText, scanMode === 'barcode' && { color: '#FFF' }]}>Barcode</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setTorch(!torch)}>
          {torch ? <ZapOff size={24} color="#FFF" /> : <Zap size={24} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {/* Bottom Bar */}
      <BlurView intensity={80} tint="dark" style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickImage} testID="gallery-pick-btn">
          <ImageIcon size={28} color="#FFF" />
          <Text style={styles.galleryBtnLabel}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureBtnWrapper} onPress={takePicture} disabled={isCapturing} testID="capture-btn">
          <View style={[styles.captureBtnOuter, isCapturing && { opacity: 0.5 }]}>
            <View style={[styles.captureBtnInner, scanMode === 'barcode' && { backgroundColor: '#3B82F6' }]} />
          </View>
          <Text style={styles.captureLabel}>{scanMode === 'barcode' ? 'Auto-Scan' : 'Capture'}</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
      </BlurView>

      {/* Analyzing Overlay */}
      {analyzing && (
        <BlurView intensity={90} tint="light" style={[StyleSheet.absoluteFillObject, styles.analyzingOverlay]}>
          <View style={styles.loadingCircleOuter}>
            <View style={styles.loadingCircleInner}>
              <ActivityIndicator size="large" color={theme.colors.mint} />
            </View>
          </View>
          <Text style={styles.analyzingTitle}>Analyzing</Text>
          <Text style={styles.analyzingStage}>{stageText}</Text>
          <Text style={styles.analyzingFooter}>InsideOut · WHO + FDA cross-reference</Text>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },

  // ── Web styles ──
  webContainer: { flex: 1, backgroundColor: theme.colors.bg },
  webHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  webHeaderTitle: { ...theme.typography.subheading, fontSize: 18 },
  webContent: { flex: 1, padding: theme.spacing.lg, justifyContent: 'center' },
  webHero: { alignItems: 'center', marginBottom: theme.spacing.xl * 1.5 },
  webIconRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: theme.colors.mintSoft, justifyContent: 'center',
    alignItems: 'center', marginBottom: theme.spacing.lg,
    borderWidth: 3, borderColor: theme.colors.mint,
  },
  webTitle: { ...theme.typography.heading, fontSize: 28, marginBottom: 8, textAlign: 'center' },
  webSubtitle: { ...theme.typography.body, fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
  webBtnGroup: { gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  webCameraBtn: {
    backgroundColor: theme.colors.mint, borderRadius: theme.radii.card,
    padding: theme.spacing.lg, alignItems: 'center', gap: 8,
  },
  webCameraBtnText: { color: '#FFF', fontWeight: '800', fontSize: 20 },
  webCameraBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  webUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: theme.radii.card,
    paddingVertical: 16, paddingHorizontal: theme.spacing.lg,
    borderWidth: 2, borderColor: theme.colors.mint,
    backgroundColor: theme.colors.mintSoft,
  },
  webUploadBtnText: { color: theme.colors.mint, fontWeight: '700', fontSize: 17 },
  webTipCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  webTipTitle: { ...theme.typography.subheading, fontSize: 15, marginBottom: 8 },
  webTip: { ...theme.typography.body, fontSize: 13, lineHeight: 22 },

  // ── Perm card ──
  permCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing.xl, alignItems: 'center', width: '100%' },
  permIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.mintSoft, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.md },
  permTitle: { ...theme.typography.heading, fontSize: 24, textAlign: 'center', marginBottom: theme.spacing.sm },
  permDesc: { ...theme.typography.body, textAlign: 'center', marginBottom: theme.spacing.xl },
  primaryBtn: { backgroundColor: theme.colors.mint, width: '100%', paddingVertical: 16, borderRadius: theme.radii.button, alignItems: 'center', marginBottom: theme.spacing.sm },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { width: '100%', paddingVertical: 16, alignItems: 'center' },
  secondaryBtnText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 16 },

  // ── Native camera ──
  cutout: { width: 240, height: 240, backgroundColor: 'transparent', position: 'relative' },
  cutoutBarcode: { width: 280, height: 160 },
  bracket: { position: 'absolute', width: 30, height: 30, borderColor: theme.colors.mint },
  bracketTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  bracketTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bracketBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  bracketBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLine: { width: '100%', height: 3, opacity: 0.9 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modeToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, padding: 3, gap: 3 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 26 },
  modeBtnActive: { backgroundColor: theme.colors.mint },
  modeBtnActiveBlue: { backgroundColor: '#3B82F6' },
  modeBtnText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 12 },
  barcodeFoundBadge: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(59,130,246,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  barcodeFoundText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 20 },
  galleryBtn: { alignItems: 'center', gap: 4 },
  galleryBtnLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  captureBtnWrapper: { alignItems: 'center' },
  captureBtnOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.mint },
  captureLabel: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  spacer: { width: 60 },

  // ── Analyzing overlay ──
  analyzingOverlay: { justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  loadingCard: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: 40, margin: 32, gap: 12 },
  loadingCircleOuter: { width: 120, height: 120, borderRadius: 60, backgroundColor: theme.colors.mintSoft, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.xl },
  loadingCircleInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  analyzingTitle: { ...theme.typography.heading, fontSize: 28, marginBottom: theme.spacing.sm },
  analyzingStage: { ...theme.typography.body, fontSize: 16, color: theme.colors.textSecondary },
  analyzingFooter: { position: 'absolute', bottom: 40, ...theme.typography.caption, fontSize: 12, fontStyle: 'italic' },
});
