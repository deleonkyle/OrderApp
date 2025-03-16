import { supabase } from "./supabase"
import { decode } from "base64-arraybuffer"
import * as FileSystem from "expo-file-system"
import { Platform } from "react-native"
import * as ImagePicker from "expo-image-picker"

const BUCKET_NAME = "item-images"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const storageService = {
  /**
   * Initialize storage bucket if it doesn't exist
   */
  async initStorage() {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME)

      if (!bucketExists) {
        // Create the bucket if it doesn't exist
        const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: true, // Make files publicly accessible
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
        })

        if (error) throw error
      }

      return true
    } catch (error) {
      console.error("Error initializing storage:", error)
      return false
    }
  },

  /**
   * Upload an image from local URI
   */
  async uploadImage(uri: string, folder: string = "items"): Promise<string | null> {
    try {
      // First check if we have the bucket
      await this.initStorage()

      // Read the file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Generate a unique filename
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
      const filePath = `${filename}`

      // Upload the file
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, decode(base64), {
          contentType: "image/jpeg",
          upsert: true
        })

      if (error) throw error

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath)

      // Ensure the URL is properly formatted
      if (!publicUrl) {
        throw new Error("Failed to get public URL")
      }

      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      return null
    }
  },

  /**
   * Pick an image from device and upload it
   */
  async pickAndUploadImage(folder: string = "items"): Promise<string | null> {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (!permissionResult.granted) {
        throw new Error("Permission to access media library was denied")
      }

      // Pick the image
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (result.canceled) {
        return null
      }

      // Upload the selected image
      const uri = result.assets[0].uri
      return await this.uploadImage(uri, folder)
    } catch (error) {
      console.error("Error picking and uploading image:", error)
      return null
    }
  },

  /**
   * Delete an image from storage
   */
  async deleteImage(url: string): Promise<boolean> {
    try {
      // Extract the file path from the URL
      const path = url.split(`${BUCKET_NAME}/`)[1]
      if (!path) throw new Error("Invalid file URL")

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path])

      if (error) throw error

      return true
    } catch (error) {
      console.error("Error deleting image:", error)
      return false
    }
  }
} 