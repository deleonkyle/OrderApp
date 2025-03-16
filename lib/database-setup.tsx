import { supabase } from "./supabase"

export const setupDatabase = async () => {
  try {
    console.log("Checking database tables...")

    // Check if customers table exists
    const { data: customersExists, error: customersCheckError } = await supabase
      .from("customers")
      .select("id")
      .limit(1)
      .maybeSingle()

    if (customersCheckError) {
      console.log("Customers table might not exist, creating it...")

      // Create customers table
      const { error: createCustomersError } = await supabase.rpc("create_customers_table")

      if (createCustomersError) {
        console.error("Error creating customers table:", createCustomersError)
      } else {
        console.log("Customers table created successfully")
      }
    }

    // Check if items table exists
    const { data: itemsExists, error: itemsCheckError } = await supabase
      .from("items")
      .select("id")
      .limit(1)
      .maybeSingle()

    if (itemsCheckError) {
      console.log("Items table might not exist, creating it...")

      // Create items table
      const { error: createItemsError } = await supabase.rpc("create_items_table")

      if (createItemsError) {
        console.error("Error creating items table:", createItemsError)
      } else {
        console.log("Items table created successfully")
      }
    }

    // Check if orders table exists
    const { data: ordersExists, error: ordersCheckError } = await supabase
      .from("orders")
      .select("id")
      .limit(1)
      .maybeSingle()

    if (ordersCheckError) {
      console.log("Orders table might not exist, creating it...")

      // Create orders table
      const { error: createOrdersError } = await supabase.rpc("create_orders_table")

      if (createOrdersError) {
        console.error("Error creating orders table:", createOrdersError)
      } else {
        console.log("Orders table created successfully")
      }
    }

    // Check if order_items table exists
    const { data: orderItemsExists, error: orderItemsCheckError } = await supabase
      .from("order_items")
      .select("id")
      .limit(1)
      .maybeSingle()

    if (orderItemsCheckError) {
      console.log("Order items table might not exist, creating it...")

      // Create order_items table
      const { error: createOrderItemsError } = await supabase.rpc("create_order_items_table")

      if (createOrderItemsError) {
        console.error("Error creating order_items table:", createOrderItemsError)
      } else {
        console.log("Order items table created successfully")
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error setting up database:", error)
    return { success: false, error }
  }
}

// Function to create stored procedures for table creation
export const setupStoredProcedures = async () => {
  try {
    // Create stored procedure for customers table
    await supabase.rpc("create_stored_procedures")
    console.log("Stored procedures created successfully")
    return { success: true }
  } catch (error) {
    console.error("Error creating stored procedures:", error)
    return { success: false, error }
  }
}

