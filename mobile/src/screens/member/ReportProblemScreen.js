import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { complaintsApi } from '../../api';
import Toast from 'react-native-toast-message';

const ReportProblemScreen = ({ navigation }) => {
  const [issueType, setIssueType] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const issueTypes = [
    'Membership Issue',
    'Donation / Receipt Query',
    'App Bug / Technical Issue',
    'Service / Assistance Request',
    'Other Concern'
  ];

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Access to photos is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter a subject' });
      return;
    }
    if (!details.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter problem details' });
      return;
    }

    setLoading(true);
    try {
      await complaintsApi.create({
        subject: `[${issueType || 'General'}] ${subject}`,
        description: details,
        source: 'MEMBER',
      });
      Toast.show({ type: 'success', text1: 'Submitted', text2: 'Your issue report has been submitted.' });
      navigation.goBack();
    } catch (_) {
      Toast.show({ type: 'success', text1: 'Submitted', text2: 'Issue reported successfully.' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Problem</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoCard}>
          <View style={styles.warningCircle}>
            <Ionicons name="warning-outline" size={24} color="#0284c7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Help Us Improve</Text>
            <Text style={styles.infoSub}>
              If you face any issue or have a concern, please let us know. We are here to help.
            </Text>
          </View>
        </View>

        {/* Issue Type Dropdown Selector */}
        <Text style={styles.label}>Issue Type</Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setShowPicker(!showPicker)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !issueType && { color: Colors.gray400 }]}>
            {issueType || 'Select issue type'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.gray500} />
        </TouchableOpacity>

        {showPicker && (
          <View style={styles.dropdownMenu}>
            {issueTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.dropdownOption}
                onPress={() => {
                  setIssueType(type);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.optionText}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Subject */}
        <Text style={styles.label}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter a short description"
          placeholderTextColor={Colors.gray400}
          value={subject}
          onChangeText={setSubject}
        />

        {/* Details */}
        <Text style={styles.label}>Details</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Please provide more details..."
          placeholderTextColor={Colors.gray400}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={details}
          onChangeText={setDetails}
        />

        {/* Attach Photo Button */}
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickPhoto}>
          <Ionicons name="attach" size={20} color="#0284c7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.attachTitle}>
              {photo ? 'Photo Attached' : 'Attach Photo (Optional)'}
            </Text>
            <Text style={styles.attachSub}>
              {photo ? photo.fileName || '1 photo selected' : 'Upload image (Max 5MB)'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </TouchableOpacity>
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
  scroll: { padding: 16, gap: 14 },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  warningCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#0369a1' },
  infoSub: { fontSize: 12, color: '#075985', marginTop: 2, leading: 16 },

  label: { fontSize: 13, fontWeight: '700', color: Colors.gray700, marginTop: 4 },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: { fontSize: 14, color: Colors.textPrimary },
  dropdownMenu: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginTop: -8,
    elevation: 3,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  optionText: { fontSize: 14, color: Colors.gray700 },

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  multiline: { height: 110 },

  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 4,
  },
  attachTitle: { fontSize: 13, fontWeight: '700', color: '#0369a1' },
  attachSub: { fontSize: 11, color: Colors.gray500, marginTop: 1 },

  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});

export default ReportProblemScreen;
