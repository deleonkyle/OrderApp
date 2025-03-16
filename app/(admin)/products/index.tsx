"use client"

import React, { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  RefreshControl,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import * as FileSystem from "expo-file-system"
import * as DocumentPicker from "expo-document-picker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { storageService } from "@/lib/storage"

interface Item {
  id: number
  code: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
}

interface ExcelItem {
  code: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
}

export default function PricelistScreen() {
  const [items, setItems] = useState<Item[]>([])
  const [filteredItems, setFilteredItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [categories, setCategories] = useState<string[]>(["All"])
  const [modalVisible, setModalVisible] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [newPrice, setNewPrice] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [showFloatingButton, setShowFloatingButton] = useState(false)
  const [scrollY] = useState(new Animated.Value(0))

  useEffect(() => {
    checkUserRole()
    fetchItems()
  }, [])

  useEffect(() => {
    filterItems()
  }, [searchQuery, selectedCategory, items])

  const checkUserRole = async () => {
    try {
      const sessionStr = await AsyncStorage.getItem("session")
      if (sessionStr) {
        const session = JSON.parse(sessionStr)
        setIsAdmin(session.role === "admin")
      }
    } catch (error) {
      console.error("Error checking user role:", error)
    }
  }

  const fetchItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true })

      if (error) throw error

      setItems(data || [])

      // Extract unique categories
      const uniqueCategories = ["All", ...new Set(data?.map((item) => item.category))]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error("Error fetching items:", error)
      Alert.alert("Error", "Failed to load pricelist")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchItems()
  }

  const filterItems = () => {
    let filtered = items

    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.category === selectedCategory)
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    setFilteredItems(filtered)
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
  }

  const handleEditPrice = (item: Item) => {
    if (!isAdmin) {
      Alert.alert("Permission Denied", "You need admin access to edit prices")
      return
    }

    setEditItem(item)
    setNewPrice(item.price.toString())
    setModalVisible(true)
  }

  const saveNewPrice = async () => {
    if (!editItem) return

    const price = Number.parseFloat(newPrice)
    if (isNaN(price) || price <= 0) {
      Alert.alert("Error", "Please enter a valid price")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from("items")
        .update({ price })
        .eq("id", editItem.id)

      if (error) throw error

      const updatedItems = items.map((item) => 
        item.id === editItem.id ? { ...item, price } : item
      )

      setItems(updatedItems)
      setModalVisible(false)
      Alert.alert("Success", "Price updated successfully")
    } catch (error) {
      console.error("Error updating price:", error)
      Alert.alert("Error", "Failed to update price")
    } finally {
      setLoading(false)
    }
  }

  const importPricelist = async () => {
    if (!isAdmin) {
      Alert.alert("Permission Denied", "You need admin access to import pricelist")
      return
    }

    try {
      Alert.alert(
        "Import Excel File",
        "Please ensure your Excel file has these columns: code, name, price, category\n\nColumn names must be lowercase and in the first row.\n\nTry using our sample-pricelist.csv file as a template.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Select File", 
            onPress: async () => {
              try {
                console.log("Starting file picker...")
                const result = await DocumentPicker.getDocumentAsync({
                  type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
                  copyToCacheDirectory: true,
                })
      
                console.log("Document picker result:", JSON.stringify(result, null, 2))
                
                if (result.canceled) {
                  console.log("User canceled document picking")
                  return
                }
                
                const selectedAsset = result.assets[0]
                console.log("Selected file:", selectedAsset.name, "mimeType:", selectedAsset.mimeType)
      
                await processExcelFile(selectedAsset.uri)
              } catch (error) {
                console.error("DocumentPicker error:", error)
                Alert.alert(
                  "File Selection Error", 
                  "Failed to access file. Please check app permissions and try again with a different file."
                )
              }
            }
          }
        ]
      )
    } catch (error) {
      console.error("Error in import process:", error)
      Alert.alert("Error", "Failed to start import process. Please try again.")
    }
  }

  const downloadAndUploadImage = async (imageUrl: string): Promise<string | null> => {
    try {
      // Download the image
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('Failed to download image')
      
      const blob = await response.blob()
      
      // Convert blob to base64 using array buffer
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      
      // Create a temporary file
      const tempUri = `${FileSystem.documentDirectory}temp_${Date.now()}.jpg`
      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      })
      
      // Upload to Supabase Storage
      const uploadedUrl = await storageService.uploadImage(tempUri)
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempUri)
      
      return uploadedUrl
    } catch (error) {
      console.error('Error processing image:', error)
      return null
    }
  }

  const processBase64Image = async (base64Data: string): Promise<string | null> => {
    try {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Content = base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data

      // Create a temporary file
      const tempUri = `${FileSystem.documentDirectory}temp_${Date.now()}.jpg`
      await FileSystem.writeAsStringAsync(tempUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64
      })
      
      // Upload to Supabase Storage
      const uploadedUrl = await storageService.uploadImage(tempUri)
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempUri)
      
      return uploadedUrl
    } catch (error) {
      console.error('Error processing base64 image:', error)
      return null
    }
  }

  const processExcelFile = async (filePath: string) => {
    try {
      console.log("Processing file:", filePath)
      
      // Read the file using FileSystem
      const fileContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64
      })

      // Convert base64 to Uint8Array for XLSX
      const binaryString = atob(fileContent)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      // Read the Excel file
      const excelWorkbook = XLSX.read(bytes, { type: 'array' })
      const excelSheetName = excelWorkbook.SheetNames[0]
      const excelWorksheet = excelWorkbook.Sheets[excelSheetName]
      const excelData = XLSX.utils.sheet_to_json(excelWorksheet)

      // Validate and process the data
      const processedItems: ExcelItem[] = excelData.map((row: any) => ({
        code: String(row.code || ""),
        name: String(row.name || ""),
        price: Number(row.price || 0),
        category: String(row.category || ""),
        description: row.description ? String(row.description) : undefined,
        image_url: row.image_url ? String(row.image_url) : undefined
      }))

      // Validate required fields
      const invalidItems = processedItems.filter(
        (item) => !item.code || !item.name || !item.price || !item.category
      )

      if (invalidItems.length > 0) {
        Alert.alert(
          "Invalid Data",
          "Some items are missing required fields (code, name, price, or category)."
        )
        return
      }
      
      let successCount = 0
      let errorCount = 0
      let imageErrorCount = 0

      // Process each item
      for (const item of processedItems) {
        try {
          let imageUrl = item.image_url

          // Process image if present
          if (imageUrl) {
            console.log("Processing image for item:", item.code)
            try {
              // Check if it's a base64 string
              if (imageUrl.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(imageUrl)) {
                console.log("Processing base64 image")
                const processedUrl = await processBase64Image(imageUrl)
                if (processedUrl) imageUrl = processedUrl
              } else {
                console.log("Processing URL image")
                const processedUrl = await downloadAndUploadImage(imageUrl)
                if (processedUrl) imageUrl = processedUrl
              }
            } catch (imageError) {
              console.error("Error processing image:", imageError)
              imageErrorCount++
              // Continue with the item even if image processing fails
            }
          }

          // Insert or update the item
          const { error } = await supabase
            .from("items")
            .upsert({
                      code: item.code,
                      name: item.name,
                      price: item.price,
                      category: item.category,
              description: item.description,
              image_url: imageUrl || undefined,
            }, {
              onConflict: 'code'
            })

          if (error) throw error
                      successCount++
        } catch (error) {
          console.error("Error processing item:", error)
                    errorCount++
                  }
                }
                
      // Show completion message
                  Alert.alert(
        "Import Complete",
        `Successfully imported ${successCount} items.\n${
          errorCount > 0 ? `${errorCount} items failed to import.\n` : ""
        }${
          imageErrorCount > 0
            ? `${imageErrorCount} images failed to process.`
            : ""
        }`
      )

      // Refresh the items list
                fetchItems()
    } catch (error) {
      console.error("Error processing file:", error)
      Alert.alert("Error", "Failed to process the Excel file.")
    }
  }

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = (event as NativeSyntheticEvent<NativeScrollEvent>).nativeEvent.contentOffset.y
        if (offsetY > 20 && isAdmin) {
          setShowFloatingButton(true)
        } else {
          setShowFloatingButton(false)
        }
      }
    }
  )

  const handleImageUpload = async (item: Item) => {
    try {
      if (!isAdmin) {
        Alert.alert("Permission Denied", "You need admin access to upload images")
        return
      }

      setLoading(true)
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
      setLoading(false)
    }
  }

  const handleDeleteImage = async (item: Item) => {
    if (!isAdmin) {
      Alert.alert("Permission Denied", "You need admin access to delete images")
      return
    }

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
              setLoading(true)
              
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
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity 
      style={styles.itemContainer} 
      onPress={() => handleEditPrice(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemImageContainer}>
        {item.image_url ? (
          <View>
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.itemImage}
              resizeMode="cover"
            />
            {isAdmin && (
              <TouchableOpacity 
                style={styles.deleteImageButton}
                onPress={() => handleDeleteImage(item)}
              >
                <Feather name="trash-2" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
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
      <View style={styles.itemDetails}>
        <View style={styles.itemCodeContainer}>
          <Text style={styles.itemCode}>{item.code}</Text>
        </View>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.itemCategory}>{item.category}</Text>
        </View>
      </View>
      <View style={styles.priceContainer}>
        <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
        {isAdmin && (
          <Feather name="edit-2" size={16} color="#666" style={styles.editIcon} />
        )}
      </View>
    </TouchableOpacity>
  )

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderText}>
        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
      </Text>
      {isAdmin && (
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => Alert.alert("Info", "Sorting is already applied by category and name")}
        >
          <Feather name="info" size={16} color="#666" />
          <Text style={styles.sortButtonText}>Sorted by category</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pricelist</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.uploadButton} onPress={importPricelist}>
            <Feather name="upload" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or code"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryButton, selectedCategory === item && styles.selectedCategory]}
              onPress={() => handleCategorySelect(item)}
            >
              <Text style={[styles.categoryText, selectedCategory === item && styles.selectedCategoryText]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4361ee" />
          <Text style={styles.loadingText}>Loading pricelist...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={64} color="#ddd" />
          <Text style={styles.emptyText}>No items found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? "Try a different search term or category" 
              : "Add items to your pricelist"}
          </Text>
        </View>
      ) : (
        <Animated.FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#4361ee"]}
              tintColor="#4361ee"
            />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      {showFloatingButton && isAdmin && (
        <TouchableOpacity style={styles.floatingButton} onPress={importPricelist}>
          <Feather name="upload" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Price</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {editItem && (
              <>
                <View style={styles.modalItemInfo}>
                  <Text style={styles.modalItemName}>{editItem.name}</Text>
                  <View style={styles.modalItemDetails}>
                    <View style={styles.modalCodeBadge}>
                      <Text style={styles.modalItemCode}>{editItem.code}</Text>
                    </View>
                    <View style={styles.modalCategoryBadge}>
                      <Text style={styles.modalItemCategory}>{editItem.category}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.priceSection}>
                  <Text style={styles.modalLabel}>Current Price</Text>
                  <Text style={styles.currentPrice}>₱{editItem.price.toFixed(2)}</Text>
                </View>

                <View style={styles.priceSection}>
                  <Text style={styles.modalLabel}>New Price</Text>
                  <View style={styles.newPriceContainer}>
                    <Text style={styles.currencySymbol}>₱</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.00"
                      value={newPrice}
                      onChangeText={setNewPrice}
                      keyboardType="numeric"
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveNewPrice}>
                    <Text style={styles.saveButtonText}>Update Price</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  uploadButton: {
    backgroundColor: "#4361ee",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    height: 50,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333",
  },
  categoriesContainer: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  selectedCategory: {
    backgroundColor: "#4361ee",
    borderColor: "#4361ee",
  },
  categoryText: {
    color: "#666",
    fontWeight: "500",
  },
  selectedCategoryText: {
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 14,
    color: "#666",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortButtonText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
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
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  deleteImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 77, 79, 0.8)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  itemDetails: {
    flex: 1,
  },
  itemCodeContainer: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  itemCode: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "600",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  itemCategory: {
    fontSize: 12,
    color: "#666",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4361ee",
  },
  editIcon: {
    marginLeft: 8,
  },
  floatingButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4361ee",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  modalItemInfo: {
    marginBottom: 24,
  },
  modalItemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  modalItemDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalCodeBadge: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  modalItemCode: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "600",
  },
  modalCategoryBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modalItemCategory: {
    fontSize: 12,
    color: "#666",
  },
  priceSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#666",
  },
  newPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    color: "#333",
    marginRight: 4,
  },
  modalInput: {
    flex: 1,
    height: 50,
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: "#4361ee",
    marginLeft: 8,
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
})