// screens/staff/StockInventoryScreen.js — Real-time Charity Stock & Inventory for Staff
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { inventoryApi } from '../../api';

const CATEGORIES = [
  'All',
  'Food / Groceries',
  'Medical Relief',
  'Clothing & Textiles',
  'Equipment & Machinery',
  'General Stock',
];

const StockInventoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.list({ is_active: true });
      setItems(res.data?.results || res.data || []);
    } catch (e) {
      console.log('Error loading inventory in mobile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  }, []);

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !search ||
        (item.item_name && item.item_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.item_code && item.item_code.toLowerCase().includes(search.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(search.toLowerCase())) ||
        (item.donor_name && item.donor_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.vendor_name && item.vendor_name.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));

      return matchSearch && matchCategory;
    });
  }, [items, search, selectedCategory]);

  const totalQuantity = items.reduce((sum, i) => sum + (Number(i.quantity_available) || 0), 0);
  const totalStockValue = items.reduce(
    (sum, i) => sum + (Number(i.quantity_available) || 0) * (Number(i.unit_value) || 0),
    0
  );
  const lowStockCount = items.filter((i) => (Number(i.quantity_available) || 0) <= 5).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Stock & Inventory</Text>
          <Text style={styles.headerSubtitle}>Real-time Trust Stock Availability</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderLeftColor: '#0284c7' }]}>
          <Text style={styles.metricLabel}>TOTAL ITEMS</Text>
          <Text style={[styles.metricValue, { color: '#0284c7' }]}>{items.length}</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#10b981' }]}>
          <Text style={styles.metricLabel}>TOTAL QUANTITY</Text>
          <Text style={[styles.metricValue, { color: '#10b981' }]}>{totalQuantity}</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#f59e0b' }]}>
          <Text style={styles.metricLabel}>LOW STOCK</Text>
          <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{lowStockCount}</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.gray400} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stock by name, code, donor, category..."
          placeholderTextColor={Colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Horizontal Filter */}
      <View style={{ height: 42, marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Item List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={{ marginTop: 12, color: Colors.gray500, fontSize: 13 }}>Loading stock inventory...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="archive-outline" size={48} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>No stock items found</Text>
              <Text style={styles.emptySubtitle}>
                {search ? 'Try adjusting your search criteria' : 'No items currently in stock'}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const isLow = (Number(item.quantity_available) || 0) <= 5;
              const hasPhoto = Boolean(item.image);

              return (
                <View key={item.id} style={styles.itemCard}>
                  {/* Photo or placeholder icon */}
                  <View style={styles.itemImgWrap}>
                    {hasPhoto ? (
                      <Image source={{ uri: item.image }} style={styles.itemImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.itemIconPlaceholder}>
                        <Ionicons name="cube-outline" size={26} color="#0284c7" />
                      </View>
                    )}
                  </View>

                  {/* Item info */}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemCode}>{item.item_code}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category || 'General'}</Text>
                      </View>
                    </View>

                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.item_name}
                    </Text>

                    {/* Stock Quantity in bold green */}
                    <View style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>Available:</Text>
                      <Text style={[styles.qtyValue, isLow && { color: '#f59e0b' }]}>
                        {item.quantity_available} {item.unit || 'pcs'}
                      </Text>
                      {isLow && (
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.lowStockBadgeText}>LOW STOCK</Text>
                        </View>
                      )}
                    </View>

                    {/* Stock Value */}
                    {item.unit_value ? (
                      <Text style={styles.itemValue}>
                        Rate: ₹{Number(item.unit_value).toLocaleString()} / {item.unit || 'unit'}
                      </Text>
                    ) : null}

                    {/* Donor or Vendor Source */}
                    {item.donor_name ? (
                      <Text style={styles.donorText} numberOfLines={1}>
                        💝 Donated by: {item.donor_name}
                      </Text>
                    ) : item.vendor_name ? (
                      <Text style={styles.donorText} numberOfLines={1}>
                        🛒 Vendor: {item.vendor_name}
                      </Text>
                    ) : null}

                    {/* Expiry Date */}
                    {item.expiry_date ? (
                      <View style={styles.expiryRow}>
                        <Ionicons name="calendar-outline" size={12} color="#15803d" />
                        <Text style={styles.expiryText}>Expires: {item.expiry_date}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#e0f2fe',
    fontWeight: '500',
    marginTop: 2,
  },

  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gray500,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },

  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray700,
  },
  categoryChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  listScroll: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    elevation: 1,
  },
  itemImgWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  itemImg: {
    width: '100%',
    height: '100%',
  },
  itemIconPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#0284c7',
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gray600,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyLabel: {
    fontSize: 12,
    color: Colors.gray500,
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16a34a',
  },
  lowStockBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lowStockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  itemValue: {
    fontSize: 11,
    color: Colors.gray600,
    marginTop: 2,
  },
  donorText: {
    fontSize: 11,
    color: '#0369a1',
    marginTop: 2,
    fontWeight: '500',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  expiryText: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '600',
  },

  loaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray600,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 4,
  },
});

export default StockInventoryScreen;
