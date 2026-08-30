import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

const EventDetailScreen = ({ route, navigation }) => {
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const event = route.params?.event || {};

  const galleryPhotos = event.photos || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setIsViewerVisible(true)}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: event.image }} style={styles.heroImage} resizeMode="cover" />
          </View>
        </TouchableOpacity>

        {/* Full Screen Image Viewer Modal */}
        <Modal visible={isViewerVisible} transparent={true} animationType="fade">
          <View style={styles.viewerContainer}>
            <SafeAreaView style={{ flex: 1 }}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setIsViewerVisible(false)}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
              <Image source={{ uri: event.image }} style={styles.fullScreenImage} resizeMode="contain" />
            </SafeAreaView>
          </View>
        </Modal>

        <View style={styles.card}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={16} color="#0284c7" />
              <Text style={styles.metaText}>{event.date}</Text>
            </View>

            <View style={styles.metaItem}>
              <Ionicons name="location" size={16} color="#0284c7" />
              <Text style={styles.metaText}>{event.location}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>About the Event</Text>
          <Text style={styles.descriptionText}>
            {event.content || event.short_description || event.description}
          </Text>

          <View style={styles.orgBox}>
            <Ionicons name="shield-checkmark" size={20} color="#0284c7" />
            <View>
              <Text style={styles.orgTitle}>Organized by Sreelakshmi Charitable Trust</Text>
              <Text style={styles.orgSub}>Dedicated to education, healthcare & community welfare.</Text>
            </View>
          </View>

          {/* Event Photos Section */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Event Photos</Text>
          <View style={styles.galleryGrid}>
            {galleryPhotos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },

  scroll: { paddingBottom: 24 },
  imageContainer: { width: '100%', aspectRatio: 3/2, backgroundColor: '#f1f5f9' },
  heroImage: { width: '100%', height: '100%' },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 16,
    zIndex: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 12 },
  metaContainer: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontWeight: '600', color: Colors.gray600 },
  divider: { height: 1, backgroundColor: Colors.gray200, marginVertical: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  descriptionText: { fontSize: 14, color: Colors.gray700, lineHeight: 22 },

  orgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  orgTitle: { fontSize: 13, fontWeight: '700', color: '#0369a1' },
  orgSub: { fontSize: 11, color: Colors.gray500, marginTop: 2 },

  galleryGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  galleryImage: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10 },
});

export default EventDetailScreen;
