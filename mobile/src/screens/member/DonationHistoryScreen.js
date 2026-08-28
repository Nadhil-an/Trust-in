import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { donationApi } from '../../api';

const DonationHistoryScreen = ({ navigation }) => {
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [donations, setDonations] = useState([]);

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const res = await donationApi.list();
      if (res.data && res.data.results) {
        // Map backend response if available
        setDonations(res.data.results);
      }
      const totalRes = await donationApi.myTotal();
      if (totalRes.data && totalRes.data.total_amount) {
        setTotalAmount(totalRes.data.total_amount);
      }
    } catch (error) {
      console.log('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Donation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Total Donation Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="heart-dislike-outline" size={28} color="#0284c7" />
          </View>
          <Text style={styles.summaryLabel}>Total Donation</Text>
          <Text style={styles.summaryAmount}>₹{totalAmount.toLocaleString()}</Text>
          <Text style={styles.summarySub}>Thank you for your kindness!</Text>
        </View>

        {/* Section Header with Filter */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Donation History</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="funnel-outline" size={14} color="#0284c7" />
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {/* List of Donation History Rows */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.listContainer}>
            {donations.map((item) => (
              <TouchableOpacity key={item.id} style={styles.donationRow} activeOpacity={0.7}>
                <View style={styles.rowIconCircle}>
                  <Ionicons name={item.icon || 'gift-outline'} size={20} color="#0284c7" />
                </View>

                <View style={styles.rowDetails}>
                  <Text style={styles.rowCategory}>{item.category || item.source_name || 'General'}</Text>
                  <Text style={styles.rowDate}>{item.date || item.created_at || 'Recent'}</Text>
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>₹{(item.amount || 0).toLocaleString()}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Motivational Banner */}
        <View style={styles.bannerCard}>
          <Text style={styles.bannerText}>Your support brings hope and creates real change.</Text>
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
  scroll: { padding: 16, gap: 16 },

  summaryCard: {
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  summaryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  summaryAmount: { fontSize: 32, fontWeight: '900', color: '#0369a1', marginVertical: 4 },
  summarySub: { fontSize: 12, color: '#0284c7', fontWeight: '500' },

  sectionHeader: {
    flexDirection: 'row',
    justify: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },

  listContainer: { gap: 10 },
  donationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowDetails: { flex: 1 },
  rowCategory: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowDate: { fontSize: 11, color: Colors.gray400, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: '#16a34a' },

  bannerCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  bannerText: { fontSize: 12, color: '#0369a1', fontWeight: '600', textAlign: 'center' },
});

export default DonationHistoryScreen;
