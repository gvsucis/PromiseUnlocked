import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MappedCategory } from '../../services/categoryTaxonomyService';

interface CategoryData {
  category: string;
  description: string;
  example: string;
  icon: string;
}

interface CategoryCardProps {
  category: CategoryData;
  isMapped: boolean;
  mappedData?: MappedCategory;
  onPress: () => void;
}

export function CategoryCard({ category, isMapped, mappedData, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        isMapped ? styles.categoryCardMapped : styles.categoryCardUnmapped,
      ]}
      onPress={onPress}
    >
      <View style={styles.categoryHeader}>
        <MaterialIcons
          name={(category.icon as any) || 'category'}
          size={28}
          color={isMapped ? '#667eea' : '#999'}
        />
      </View>
      <Text style={styles.categoryTitle}>{category.category}</Text>
      <Text style={styles.categoryDescription}>{category.description}</Text>
      {isMapped && (
        <View style={styles.mappedBadge}>
          <MaterialIcons name="check-circle" size={16} color="#fff" />
          <Text style={styles.mappedText}>Mapped! Tap for details</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    width: '48%',
    padding: 15,
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryCardMapped: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  categoryCardUnmapped: {
    opacity: 0.6,
  },
  categoryHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  categoryDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  mappedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 10,
    gap: 5,
  },
  mappedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
