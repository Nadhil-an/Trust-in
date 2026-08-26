// components/shared/LineItemTable.js
import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_CATEGORIES = ['MEDICINE', 'EQUIPMENT', 'CONSTRUCTION', 'FOOD', 'TRANSPORT', 'OTHER'];
const SOURCES = ['PURCHASE_NEEDED', 'FROM_INVENTORY'];

const LineItemTable = ({ items = [], onChange, inventoryItems = [] }) => {
  const addItem = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const newItem = {
      id: Date.now().toString(),
      item: '',
      category: 'OTHER',
      qty: '1',
      unit: 'unit',
      unit_cost: '',
      total: 0,
      source: 'PURCHASE_NEEDED',
    };
    onChange([...items, newItem]);
  };

  const removeItem = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    const updated = items.map(item => {
      if (item.id !== id) return item;
      const updatedItem = { ...item, [field]: value };
      // Recalculate total
      const rawQty = field === 'qty' ? value : updatedItem.qty;
      const parsedQty = parseFloat(rawQty);
      const qty = isNaN(parsedQty) ? 1 : parsedQty;
      
      const rawCost = field === 'unit_cost' ? value : updatedItem.unit_cost;
      const parsedCost = parseFloat(rawCost);
      const cost = isNaN(parsedCost) ? 0 : parsedCost;
      
      updatedItem.total = qty * cost;
      return updatedItem;
    });
    onChange(updated);
  };

  const grandTotal = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
  const inventoryTotal = items
    .filter(i => i.source === 'FROM_INVENTORY')
    .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
  const purchaseTotal = items
    .filter(i => i.source === 'PURCHASE_NEEDED')
    .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

  return (
    <View style={styles.container}>
      {/* Column headers */}
      {items.length > 0 && (
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, { flex: 3 }]}>Item</Text>
          <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Qty</Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>Unit ₹</Text>
          <Text style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}>Total ₹</Text>
          <View style={{ width: 28 }} />
        </View>
      )}

      {items.map((item, index) => (
        <View key={item.id} style={[styles.row, item.source === 'FROM_INVENTORY' && styles.inventoryRow]}>
          {/* Item name + category */}
          <View style={styles.rowTop}>
            <TextInput
              style={styles.itemNameInput}
              value={item.item}
              onChangeText={v => updateItem(item.id, 'item', v)}
              placeholder="Item name..."
              placeholderTextColor={Colors.gray400}
            />
            <TouchableOpacity
              style={[styles.sourceChip, item.source === 'FROM_INVENTORY' && styles.inventoryChip]}
              onPress={() => updateItem(item.id, 'source',
                item.source === 'FROM_INVENTORY' ? 'PURCHASE_NEEDED' : 'FROM_INVENTORY'
              )}
            >
              <Ionicons
                name={item.source === 'FROM_INVENTORY' ? 'archive' : 'cart'}
                size={11}
                color={item.source === 'FROM_INVENTORY' ? Colors.success : Colors.primary}
              />
              <Text style={[styles.sourceChipText, item.source === 'FROM_INVENTORY' && { color: Colors.success }]}>
                {item.source === 'FROM_INVENTORY' ? 'Stock' : 'Buy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Qty + Unit + Cost + Total + Delete */}
          <View style={styles.rowBottom}>
            <TextInput
              style={[styles.numInput, { flex: 1 }]}
              value={item.qty !== undefined && item.qty !== null ? String(item.qty) : ''}
              onChangeText={v => updateItem(item.id, 'qty', v)}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={Colors.gray400}
            />
            <TextInput
              style={[styles.unitInput, { flex: 1 }]}
              value={item.unit !== undefined && item.unit !== null ? String(item.unit) : ''}
              onChangeText={v => updateItem(item.id, 'unit', v)}
              placeholder="unit"
              placeholderTextColor={Colors.gray400}
            />
            <TextInput
              style={[styles.numInput, { flex: 2 }]}
              value={item.unit_cost !== undefined && item.unit_cost !== null ? String(item.unit_cost) : ''}
              onChangeText={v => updateItem(item.id, 'unit_cost', v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.gray400}
            />
            <Text style={[styles.totalText, { flex: 2 }]}>
              ₹{(parseFloat(item.total) || 0).toFixed(0)}
            </Text>
            <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Add Item Button */}
      <TouchableOpacity style={styles.addBtn} onPress={addItem}>
        <Ionicons name="add-circle" size={20} color={Colors.primary} />
        <Text style={styles.addBtnText}>Add Line Item</Text>
      </TouchableOpacity>

      {/* Summary */}
      {items.length > 0 && (
        <View style={styles.summary}>
          {inventoryTotal > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryLabel}>From Charity Stock</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{inventoryTotal.toFixed(0)}</Text>
            </View>
          )}
          {purchaseTotal > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.summaryLabel}>Purchase Required</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>₹{purchaseTotal.toFixed(0)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Estimated Cost</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(0)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.gray50, borderRadius: 8, marginBottom: 4,
  },
  headerCell: { fontSize: 11, fontWeight: '700', color: Colors.gray500, textTransform: 'uppercase' },
  row: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.gray200,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  inventoryRow: { borderColor: Colors.success + '60', backgroundColor: Colors.successLight + '20' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemNameInput: {
    flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary,
    borderBottomWidth: 1, borderBottomColor: Colors.gray200, paddingVertical: 4,
  },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  inventoryChip: { backgroundColor: Colors.successLight, borderColor: Colors.success + '40' },
  sourceChipText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numInput: {
    fontSize: 13, color: Colors.textPrimary, fontWeight: '600',
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, backgroundColor: Colors.gray50,
  },
  unitInput: {
    fontSize: 12, color: Colors.gray600,
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, backgroundColor: Colors.gray50,
  },
  totalText: {
    fontSize: 14, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right',
  },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: 12, padding: 12, justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  summary: {
    marginTop: 12, padding: 14, borderRadius: 12,
    backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.gray200,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginRight: 8 },
  summaryLabel: { flex: 1, fontSize: 13, color: Colors.gray600 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  totalRow: {
    borderTopWidth: 1, borderTopColor: Colors.gray300,
    paddingTop: 10, marginTop: 4, marginBottom: 0,
  },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
});

export default LineItemTable;
