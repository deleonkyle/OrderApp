"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { storageService } from "@/lib/storage"

interface Item {
  id: string
  code: string
  name: string
  price: number
  category?: string
  description?: string
  image_url?: string
}

export default function ManageItemsScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("name")

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error("Error fetching items:", error)
      Alert.alert("Error", "Failed to load items")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (item: Item) => {
    try {
      setIsLoading(true)
      const imageUrl = await storageService.pickAndUploadImage()
      
      if (!imageUrl) {
        console.log("Image upload cancelled or failed")
        return
      }

      // Update item with new image URL
      const { error } = await supabase
        .from("items")
        .update({ image_url: imageUrl })
        .eq("id", item.id)

      if (error) throw error

      // Update local state
      setItems(items.map(i => 
        i.id === item.id 
          ? { ...i, image_url: imageUrl }
          : i
      ))

      Alert.alert("Success", "Image uploaded successfully!")
    } catch (error) {
      console.error("Error uploading image:", error)
      Alert.alert("Error", "Failed to upload image")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteImage = async (item: Item) => {
    if (!item.image_url) return

    Alert.alert(
      "Delete Image",
      "Are you sure you want to delete this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true)
              
              // Delete from storage
              await storageService.deleteImage(item.image_url!)

              // Update item in database
              const { error } = await supabase
                .from("items")
                .update({ image_url: null })
                .eq("id", item.id)

              if (error) throw error

              // Update local state
              setItems(items.map(i => 
                i.id === item.id 
                  ? { ...i, image_url: undefined }
                  : i
              ))

              Alert.alert("Success", "Image deleted successfully!")
            } catch (error) {
              console.error("Error deleting image:", error)
              Alert.alert("Error", "Failed to delete image")
            } finally {
              setIsLoading(false)
            }
          }
        }
      ]
    )
  }

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemImageContainer}>
        {item.image_url ? (
          <>
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.itemImage}
              resizeMode="cover"
            />
            <TouchableOpacity 
              style={styles.deleteImageButton}
              onPress={() => handleDeleteImage(item)}
            >
              <Feather name="trash-2" size={16} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity 
            style={styles.uploadImageButton}
            onPress={() => handleImageUpload(item)}
          >
            <Feather name="upload" size={24} color="#666" />
            <Text style={styles.uploadImageText}>Upload Image</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCode}>{item.code}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.itemFooter}>
          <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
          {item.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{item.category}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Items</Text>
        <TouchableOpacity style={styles.addButton}>
          <Feather name="plus" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.itemsList}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Feather name="package" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No items found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  itemsList: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImageContainer: {
    width: "100%",
    height: 200,
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  uploadImageButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadImageText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  deleteImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 77, 79, 0.8)",
    borderRadius: 20,
    padding: 8,
  },
  itemInfo: {
    padding: 16,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  categoryTag: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  categoryTagText: {
    fontSize: 14,
    color: "#0369a1",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
  },
}) 