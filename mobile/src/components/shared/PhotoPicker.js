// components/shared/PhotoPicker.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { useTranslation } from 'react-i18next';

const PhotoPicker = ({ photos = [], onPhotosChange, maxPhotos = 5 }) => {
  const { t } = useTranslation();

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      addPhoto(result.assets[0]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos - photos.length,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.slice(0, maxPhotos - photos.length);
      onPhotosChange([...photos, ...newPhotos]);
    }
  };

  const addPhoto = (asset) => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Limit reached', t('errors.max_photos'));
      return;
    }
    onPhotosChange([...photos, asset]);
  };

  const removePhoto = (index) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
  };

  const showOptions = () => {
    Alert.alert(t('common.add_photo'), '', [
      { text: t('common.camera'), onPress: pickFromCamera },
      { text: t('common.gallery'), onPress: pickFromGallery },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(index)}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < maxPhotos && (
            <TouchableOpacity style={styles.addBtn} onPress={showOptions}>
              <Ionicons name="camera-outline" size={28} color={Colors.primary} />
              <Text style={styles.addText}>{t('common.add_photo')}</Text>
              <Text style={styles.counter}>{photos.length}/{maxPhotos}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  photoWrapper: { position: 'relative' },
  photo: { width: 90, height: 90, borderRadius: 10, backgroundColor: Colors.gray100 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: Colors.white, borderRadius: 10,
  },
  addBtn: {
    width: 90, height: 90, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed', alignItems: 'center',
    justifyContent: 'center', backgroundColor: Colors.primaryLight,
  },
  addText: { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '500' },
  counter: { fontSize: 10, color: Colors.gray400 },
});

export default PhotoPicker;
