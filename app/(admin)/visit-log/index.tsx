"use client"

import { useState, useEffect } from "react"
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { supabase } from "@/lib/supabase"
import { authService } from "@/lib/auth"
import { format } from "date-fns"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import { Picker } from "@react-native-picker/picker"
import type { Database } from "@/types/database"
import * as XLSX from "xlsx"

type Customer = Database["public"]["Tables"]["customers"]["Row"]
type VisitLog = Database["public"]["Tables"]["visit_log"]["Row"]

interface VisitLogWithCustomerName extends VisitLog {
  customer_name?: string
  customer_barangay?: string
  customer_town?: string
  customer_province?: string
  customer_contact_person?: string
  customer_contact_number?: string
}

// Transportation mode options
const TRANSPORT_MODES = {
  MOTORCYCLE: "With owned motorcycle service",
  TRICYCLE: "T-TRICYCLE",
  JEEP: "J-JEEP",
  BUS: "B-BUS",
  VAN: "UV-VAN",
}

export default function VisitLogsScreen() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [visitLogs, setVisitLogs] = useState<VisitLogWithCustomerName[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [travelTime, setTravelTime] = useState<string>("")
  const [fareAmount, setFareAmount] = useState<string>("")
  const [remarks, setRemarks] = useState<string>("")
  const [transportMode, setTransportMode] = useState<string>("")
  const [toNextTime, setToNextTime] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adminInfo, setAdminInfo] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"form" | "logs">("logs")

  // Common travel time options for dropdown
  const travelTimeOptions = [
    "5 mins",
    "10 mins",
    "15 mins",
    "20 mins",
    "25 mins",
    "30 mins",
    "35 mins",
    "40 mins",
    "45 mins",
    "1 hour",
    "1.5 hours",
    "2 hours",
  ]

  // Convert travel time string to Postgres interval format
  const travelTimeToInterval = (time: string): string => {
    if (time.includes("hour")) {
      // Handle hours format
      if (time.includes(".")) {
        // Handle decimal hours like "1.5 hours"
        const hours = Number.parseFloat(time.split(" ")[0])
        const wholeHours = Math.floor(hours)
        const minutes = (hours - wholeHours) * 60
        return `${wholeHours} hours ${minutes} minutes`
      }
      return time.replace("hour", "hour").replace("hours", "hours")
    } else {
      // Handle minutes format
      return time
    }
  }

  useEffect(() => {
    fetchAdminId()
    fetchCustomers()
    fetchVisitLogs()
  }, [])

  const fetchAdminId = async () => {
    const id = await authService.getUserId()
    setAdminId(id)

    if (id) {
      try {
        const { data, error } = await supabase.from("admins").select("*").eq("id", id).single()

        if (error) throw error
        setAdminInfo(data)
      } catch (error) {
        console.error("Error fetching admin info:", error)
      }
    }
  }

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.from("customers").select("*").order("name")

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
      Alert.alert("Error", "Failed to load customers")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVisitLogs = async () => {
    try {
      setIsLoading(true)

      // First, just get the basic visit logs data
      const { data: basicData, error: basicError } = await supabase
        .from("visit_log")
        .select("*")
        .order("visit_date", { ascending: false })

      if (basicError) {
        throw basicError
      }

      // Then, separately get the customer info for each log
      const logsWithCustomerNames = await Promise.all(
        (basicData || []).map(async (log) => {
          try {
            const { data: customerData, error: customerError } = await supabase
              .from("customers")
              .select("name, barangay, town, province, contact_person, contact_number")
              .eq("id", log.customer_id)
              .single()

            if (customerError) throw customerError

            return {
              ...log,
              customer_name: customerData?.name || "Unknown Customer",
              customer_barangay: customerData?.barangay || "",
              customer_town: customerData?.town || "",
              customer_province: customerData?.province || "",
              customer_contact_person: customerData?.contact_person || "",
              customer_contact_number: customerData?.contact_number || "",
            }
          } catch (e) {
            return {
              ...log,
              customer_name: "Unknown Customer",
            }
          }
        }),
      )

      setVisitLogs(logsWithCustomerNames)
    } catch (error) {
      console.error("Error fetching visit logs:", error)
      Alert.alert("Error", "Failed to load visit logs")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchVisitLogs()
  }

  const validateForm = () => {
    if (!selectedCustomerId) {
      Alert.alert("Error", "Please select a customer")
      return false
    }
    if (!travelTime) {
      Alert.alert("Error", "Please enter travel time")
      return false
    }
    if (!fareAmount || isNaN(Number(fareAmount))) {
      Alert.alert("Error", "Please enter a valid fare amount")
      return false
    }
    if (!transportMode) {
      Alert.alert("Error", "Please select a transportation mode")
      return false
    }
    return true
  }

  const handleSaveVisitLog = async () => {
    if (!validateForm() || !adminId) return

    try {
      setIsSubmitting(true)

      // Validate that the customer exists
      const { data: customerCheck, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("id", selectedCustomerId)
        .single()

      if (customerError) {
        Alert.alert("Error", "Selected customer not found. Please try again.")
        return
      }

      const { data, error } = await supabase
        .from("visit_log")
        .insert({
          customer_id: selectedCustomerId,
          admin_id: adminId,
          visit_date: new Date().toISOString(),
          travel_time: travelTimeToInterval(travelTime),
          fare_amount: Number(fareAmount),
          remarks: remarks.trim() || null,
          transport_mode: transportMode,
          to_next_time: toNextTime || null,
        })
        .select()

      if (error) {
        throw error
      }

      Alert.alert("Success", "Visit log saved successfully")

      // Reset form
      setSelectedCustomerId("")
      setTravelTime("")
      setFareAmount("")
      setRemarks("")
      setTransportMode("")
      setToNextTime("")

      // Refresh the list
      fetchVisitLogs()
      setActiveTab("logs")
    } catch (error) {
      console.error("Error saving visit log:", error)
      Alert.alert("Error", "Failed to save visit log")
    } finally {
      setIsSubmitting(false)
    }
  }

  const exportVisitLogs = async () => {
    try {
      setIsLoading(true)

      // Get basic visit logs data
      const { data: visitLogData, error: visitLogError } = await supabase
        .from("visit_log")
        .select("*")
        .order("visit_date", { ascending: false })

      if (visitLogError) throw visitLogError

      // Group logs by date
      const logsByDate =
        visitLogData?.reduce((acc: any, log: any) => {
          const date = format(new Date(log.visit_date), "yyyy-MM-dd")
          if (!acc[date]) {
            acc[date] = []
          }
          acc[date].push(log)
          return acc
        }, {}) || {}

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Add title page with admin info
      const titleData = [
        ["2025 SALES DEVELOPMENT OFFICER DAILY ITINERARY"],
        [""],
        ["SDO NAME:", adminInfo?.name || ""],
        ["AREA COVERED:", adminInfo?.area_covered || ""],
        ["AREA CODE:", adminInfo?.area_code || ""],
        ["DEPARTMENT:", adminInfo?.department || ""],
        [""],
        ["MODE OF TRANSPORTATION"],
        ["T-TRICYCLE"],
        ["J-JEEP"],
        ["B-BUS"],
        ["UV-VAN"],
      ]

      const titleWs = XLSX.utils.aoa_to_sheet(titleData)

      // Style the title
      titleWs["A1"] = {
        t: "s",
        v: "2025 SALES DEVELOPMENT OFFICER DAILY ITINERARY",
        s: {
          font: { bold: true, sz: 14 },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        },
      }

      // Merge cells for title
      titleWs["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]

      // Add title worksheet
      XLSX.utils.book_append_sheet(wb, titleWs, "Info")

      // Process each day's logs
      let dayNumber = 1

      for (const date in logsByDate) {
        const logs = logsByDate[date]

        // Create array to hold data for Excel
        const excelData = []

        // Add title row with DAY number
        excelData.push([`DAY ${dayNumber}`, "", "", "", "", "", "", "", "", "", "", "", ""])

        // Add header row
        excelData.push([
          "NO",
          "CLIENT NAME",
          "Barangay",
          "Town",
          "Province",
          "Account Status",
          "Contact Person",
          "Contact Numbers",
          "( Point to Point )",
          "Total Fare Amount",
          "Time",
          "TO NEXT",
          "REMARKS",
        ])

        // Process each log with customer data
        let totalFareAmount = 0
        let rowNumber = 1

        for (const log of logs) {
          try {
            // Fetch customer data separately
            const { data: customerData, error: customerError } = await supabase
              .from("customers")
              .select("name, barangay, town, province, contact_person, contact_number")
              .eq("id", log.customer_id)
              .single()

            if (customerError) throw customerError

            const customerName = customerData?.name || "Unknown"
            const barangay = customerData?.barangay || ""
            const town = customerData?.town || ""
            const province = customerData?.province || ""
            const contactPerson = customerData?.contact_person || ""
            const contactNumber = customerData?.contact_number || ""

            // Add to total fare amount
            totalFareAmount += Number.parseFloat(log.fare_amount.toString())

            // Get travel time in minutes for the Time column
            const timeInMinutes = log.travel_time.includes("hour")
              ? Number.parseInt(log.travel_time.split(" ")[0]) * 60 +
                (log.travel_time.includes("minutes")
                  ? Number.parseInt(log.travel_time.split("minutes")[0].split("hours ")[1])
                  : 0)
              : Number.parseInt(log.travel_time)

            // Format travel time for display
            const formattedTime =
              timeInMinutes >= 60
                ? `${Math.floor(timeInMinutes / 60)} hours ${timeInMinutes % 60 > 0 ? (timeInMinutes % 60) + " mins" : ""}`
                : `${timeInMinutes} mins`

            excelData.push([
              rowNumber,
              customerName,
              barangay,
              town,
              province,
              "Buying", // Default account status as in image
              contactPerson,
              contactNumber,
              log.transport_mode || "", // Use transport_mode for Point to Point
              log.fare_amount,
              formattedTime,
              log.to_next_time || "", // TO NEXT column
              log.remarks || "", // REMARKS column
            ])

            rowNumber++
          } catch (e) {
            console.error("Error processing log for export:", e)
          }
        }

        // Add empty rows to match format (rows 11 and 12 in the image)
        while (rowNumber <= 12) {
          excelData.push([rowNumber, "", "", "", "", "", "", "", "", "", "", "", ""])
          rowNumber++
        }

        // Add "Back to Homebase" row
        excelData.push(["", "", "", "", "", "", "", "Back to Homebase", "", "", "", "", ""])

        // Add total row
        excelData.push(["", "", "", "", "", "", "", "", "TOTAL = ₱", totalFareAmount.toFixed(2), "", "", ""])

        // Create worksheet and add data
        const ws = XLSX.utils.aoa_to_sheet(excelData)

        // Set column widths to match the image
        const columnWidths = [
          { wch: 4 }, // NO
          { wch: 25 }, // CLIENT NAME
          { wch: 15 }, // Barangay
          { wch: 10 }, // Town
          { wch: 10 }, // Province
          { wch: 14 }, // Account Status
          { wch: 16 }, // Contact Person
          { wch: 14 }, // Contact Numbers
          { wch: 30 }, // Point to Point
          { wch: 16 }, // Total Fare Amount
          { wch: 10 }, // Time
          { wch: 10 }, // TO NEXT
          { wch: 25 }, // REMARKS
        ]

        ws["!cols"] = columnWidths

        // Style cells
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1:M15")

        // Apply borders and styling to all cells in the data range
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
            const cell = ws[cellAddress] || { t: "s", v: "" }
            if (!ws[cellAddress]) ws[cellAddress] = cell

            // Add borders to all cells
            cell.s = cell.s || {}
            cell.s.border = {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            }

            // Center alignment for specific columns
            if (C === 0 || C === 5 || C === 9 || C === 10 || C === 11) {
              // NO, Account Status, Total Fare, Time, TO NEXT
              cell.s.alignment = { horizontal: "center", vertical: "center" }
            } else {
              cell.s.alignment = { vertical: "center" }
            }

            // Format specific data types
            if (C === 9 && R > 1 && R < range.e.r) {
              // Total Fare Amount column
              // Format as currency
              cell.t = "n"
              cell.s.numFmt = "0.00"
            }
          }
        }

        // Style DAY header
        const dayHeaderCell = ws["A1"]
        if (dayHeaderCell) {
          dayHeaderCell.s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          }
        }

        // Style the column header row
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: 1, c: C })] // Header is row 1 (0-indexed)
          if (!cell) continue
          cell.s = {
            fill: { fgColor: { rgb: "FFFFCC" } }, // Light yellow background
            font: { bold: true },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          }
        }

        // Style the total row
        const totalRow = range.e.r
        const totalLabelCell = ws[XLSX.utils.encode_cell({ r: totalRow, c: 8 })] // I column, TOTAL = ₱
        if (totalLabelCell) {
          totalLabelCell.s = {
            font: { bold: true },
            alignment: { horizontal: "right", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          }
        }

        const totalValueCell = ws[XLSX.utils.encode_cell({ r: totalRow, c: 9 })] // J column, amount
        if (totalValueCell) {
          totalValueCell.t = "n" // Set to number type
          totalValueCell.s = {
            font: { bold: true },
            numFmt: "0.00", // Format as currency
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          }
        }

        // Set row heights
        const rowHeights: { [key: number]: { hpt: number } } = {}
        rowHeights[0] = { hpt: 25 } // DAY header
        rowHeights[1] = { hpt: 30 } // Column headers
        for (let i = 2; i <= totalRow; i++) {
          rowHeights[i] = { hpt: 25 } // Data rows
        }
        const rowInfoArray: XLSX.RowInfo[] = []
        // Convert object to array expected by xlsx
        for (let i = 0; i <= totalRow; i++) {
          rowInfoArray[i] = rowHeights[i] || { hpt: 25 }
        }
        ws["!rows"] = rowInfoArray

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, `Day ${dayNumber}`)

        dayNumber++
      }

      // Generate filename with date
      const date = format(new Date(), "yyyy-MM-dd")
      const fileName = `daily_itinerary_${date}.xlsx`
      const filePath = `${FileSystem.documentDirectory}${fileName}`

      // Write to file
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" })
      await FileSystem.writeAsStringAsync(filePath, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Daily Itinerary",
          UTI: "com.microsoft.excel.xlsx",
        })
      } else {
        Alert.alert("Error", "Sharing is not available on this device")
      }
    } catch (error) {
      console.error("Error exporting visit logs:", error)
      Alert.alert("Error", "Failed to export visit logs")
    } finally {
      setIsLoading(false)
    }
  }

  const renderVisitLogItem = ({ item }: { item: VisitLogWithCustomerName }) => {
    const date = format(new Date(item.visit_date), "MMM dd, yyyy")

    return (
      <View style={styles.visitLogCard}>
        <View style={styles.visitLogHeader}>
          <View style={styles.customerInfoHeader}>
            <Text style={styles.customerName}>{item.customer_name || "Unknown Customer"}</Text>
            <Text style={styles.visitDate}>{date}</Text>
          </View>
          <View style={styles.fareContainer}>
            <Text style={styles.fareAmount}>₱{item.fare_amount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.visitLogDetails}>
          <View style={styles.detailsGrid}>
            <View style={styles.detailColumn}>
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={16} color="#666" />
                <Text style={styles.detailText}>
                  {item.customer_barangay}, {item.customer_town}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="user" size={16} color="#666" />
                <Text style={styles.detailText}>{item.customer_contact_person}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="phone" size={16} color="#666" />
                <Text style={styles.detailText}>{item.customer_contact_number}</Text>
              </View>
            </View>

            <View style={styles.detailColumn}>
              <View style={styles.detailRow}>
                <Feather name="clock" size={16} color="#666" />
                <Text style={styles.detailText}>{item.travel_time}</Text>
              </View>

              <View style={styles.detailRow}>
                <Feather name="truck" size={16} color="#666" />
                <Text style={styles.detailText}>{item.transport_mode}</Text>
              </View>

              {item.to_next_time && (
                <View style={styles.detailRow}>
                  <Feather name="arrow-right" size={16} color="#666" />
                  <Text style={styles.detailText}>To Next: {item.to_next_time}</Text>
                </View>
              )}
            </View>
          </View>

          {item.remarks && (
            <View style={styles.remarksContainer}>
              <Feather name="file-text" size={16} color="#666" />
              <Text style={styles.remarksText}>{item.remarks}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Itinerary</Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportVisitLogs} disabled={isLoading}>
          <Feather name="download" size={24} color="#0ea5e9" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "logs" && styles.activeTab]}
          onPress={() => setActiveTab("logs")}
        >
          <Feather name="list" size={18} color={activeTab === "logs" ? "#0ea5e9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "logs" && styles.activeTabText]}>Visit Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "form" && styles.activeTab]}
          onPress={() => setActiveTab("form")}
        >
          <Feather name="plus-circle" size={18} color={activeTab === "form" ? "#0ea5e9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "form" && styles.activeTabText]}>Add New</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidView}>
        {activeTab === "form" ? (
          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Log New Visit</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Customer</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedCustomerId}
                    onValueChange={(value: string) => setSelectedCustomerId(value)}
                    style={styles.picker}
                    enabled={!isSubmitting}
                  >
                    <Picker.Item label="Select a customer" value="" />
                    {customers.map((customer) => (
                      <Picker.Item key={customer.id} label={customer.name} value={customer.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Travel Time</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={travelTime}
                    onValueChange={(value: string) => setTravelTime(value)}
                    style={styles.picker}
                    enabled={!isSubmitting}
                  >
                    <Picker.Item label="Select travel time" value="" />
                    {travelTimeOptions.map((time) => (
                      <Picker.Item key={time} label={time} value={time} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Fare Amount (₱)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter fare amount"
                  value={fareAmount}
                  onChangeText={setFareAmount}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Transportation Mode</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={transportMode}
                    onValueChange={(value: string) => setTransportMode(value)}
                    style={styles.picker}
                    enabled={!isSubmitting}
                  >
                    <Picker.Item label="Select transportation mode" value="" />
                    <Picker.Item label="With owned motorcycle service" value={TRANSPORT_MODES.MOTORCYCLE} />
                    <Picker.Item label="T-TRICYCLE" value={TRANSPORT_MODES.TRICYCLE} />
                    <Picker.Item label="J-JEEP" value={TRANSPORT_MODES.JEEP} />
                    <Picker.Item label="B-BUS" value={TRANSPORT_MODES.BUS} />
                    <Picker.Item label="UV-VAN" value={TRANSPORT_MODES.VAN} />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Time to Next Point (Optional)</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={toNextTime}
                    onValueChange={(value: string) => setToNextTime(value)}
                    style={styles.picker}
                    enabled={!isSubmitting}
                  >
                    <Picker.Item label="Select time to next point" value="" />
                    {travelTimeOptions.map((time) => (
                      <Picker.Item key={`tonext-${time}`} label={time} value={time} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Remarks (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter any remarks or notes"
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                  numberOfLines={4}
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
                onPress={handleSaveVisitLog}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Visit Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#0ea5e9"]} />}
          >
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Feather name="map-pin" size={24} color="#0ea5e9" />
                <Text style={styles.statValue}>{visitLogs.length}</Text>
                <Text style={styles.statLabel}>Total Visits</Text>
              </View>

              <View style={styles.statCard}>
                <Feather name="dollar-sign" size={24} color="#0ea5e9" />
                <Text style={styles.statValue}>
                  ₱{visitLogs.reduce((sum, log) => sum + log.fare_amount, 0).toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Total Expenses</Text>
              </View>
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Recent Visit Logs</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setActiveTab("form")}>
                <Feather name="plus" size={20} color="#0ea5e9" />
                <Text style={styles.addButtonText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {isLoading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={styles.loadingText}>Loading visit logs...</Text>
              </View>
            ) : visitLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Image
                  source={{ uri: "https://v0.dev/placeholder.svg?height=200&width=200" }}
                  style={styles.emptyImage}
                />
                <Text style={styles.emptyTitle}>No visit logs yet</Text>
                <Text style={styles.emptyText}>Start by adding your first visit log</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => setActiveTab("form")}>
                  <Text style={styles.emptyButtonText}>Add Visit Log</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={visitLogs}
                renderItem={renderVisitLogItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false} // Disable scrolling as we're already in a ScrollView
              />
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  exportButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0ea5e9",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#0ea5e9",
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  formCard: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
    height: 50,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0ea5e9",
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  visitLogCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  visitLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 12,
  },
  customerInfoHeader: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  visitDate: {
    fontSize: 14,
    color: "#666",
  },
  fareContainer: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 8,
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  visitLogDetails: {
    gap: 12,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 16,
  },
  detailColumn: {
    flex: 1,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  remarksContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  remarksText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
})

