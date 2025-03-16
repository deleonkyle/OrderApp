# Excel Import Guide for Pricelist Management

This guide will help you create a valid Excel file for importing your product pricelist into the Order Management App.

## Required Excel Format

Your Excel file must follow this exact format to be successfully imported:

| code | name | price | category | description | image_url |
|------|------|-------|----------|-------------|-----------|
| P001 | Product Name 1 | 199.99 | Category A | Detailed product description | https://example.com/image1.jpg |
| P002 | Product Name 2 | 299.99 | Category B | Another product description | https://example.com/image2.jpg |
| P003 | Product Name 3 | 99.50 | Category A | Yet another description | https://example.com/image3.jpg |

### Important Rules:

1. **Column Names**: 
   - Must be exactly: `code`, `name`, `price`, `category`, `description`, `image_url`
   - Must be in lowercase
   - Must be in the first row of the spreadsheet

2. **Product Code**:
   - Must be unique for each product
   - Will be used to update existing products if the code already exists
   - Alphanumeric values are supported (e.g., "P001", "ITEM-123")

3. **Price**:
   - Must be a numeric value
   - Can include decimals (e.g., 19.99)
   - Do not include currency symbols (no "$" or "₱")
   - Must be greater than or equal to 0

4. **Description**:
   - Optional field
   - Can contain detailed product information
   - Maximum length: 1000 characters
   - Can include line breaks and special characters
   - If left empty, no description will be set for the product

5. **Image URL**:
   - Optional field
   - Must be a valid URL to a publicly accessible image
   - Supported formats: JPG, PNG, WebP
   - Maximum file size: 5MB
   - If left empty, no image will be set for the product

6. **File Format**:
   - Must be a valid Excel file (.xlsx format)
   - File should have only one worksheet with data

## Step-by-Step Instructions

### Creating Your Excel File

1. Open Microsoft Excel or a compatible spreadsheet program
2. Create a new blank workbook
3. In row 1, add the following column headers:
   - Column A: `code`
   - Column B: `name`
   - Column C: `price`
   - Column D: `category`
   - Column E: `description`
   - Column F: `image_url`
4. Enter your product data in rows below, starting from row 2
5. Save the file as .xlsx format

### Importing Your Excel File

1. Log in as an Admin to the Order Management App
2. Navigate to the Pricelist screen
3. Click the upload button in the top-right corner
4. Select your Excel file when prompted
5. Review the import summary and confirm

## Troubleshooting Common Issues

### File Not Recognized

- Make sure your file is in .xlsx format (Excel 2007 or newer)
- Check that the file is not corrupted or protected

### No Valid Items Found

- Verify that your column headers are exactly as specified (lowercase, no spaces)
- Check if there are empty rows at the top of your spreadsheet
- Make sure you have data rows below the header row

### Items Failed to Import

- Check for duplicate product codes in your Excel file
- Verify that price values are valid numbers
- Ensure category values don't contain special characters
- For descriptions, make sure they don't exceed 1000 characters
- For image URLs, make sure they are valid and publicly accessible

## Example Data

Here's a sample set of data you can use to test your import:

| code | name | price | category | description | image_url |
|------|------|-------|----------|-------------|-----------|
| P001 | Basic T-Shirt | 19.99 | Apparel | Comfortable cotton t-shirt with a classic fit. Available in various sizes and colors. | https://example.com/tshirt.jpg |
| P002 | Deluxe Headphones | 89.99 | Electronics | High-quality wireless headphones with noise cancellation and 30-hour battery life. | https://example.com/headphones.jpg |
| P003 | Coffee Mug | 12.50 | Kitchenware | Ceramic mug with a heat-resistant handle and dishwasher-safe design. | https://example.com/mug.jpg |
| P004 | Wireless Mouse | 24.99 | Electronics | Ergonomic wireless mouse with precise tracking and long battery life. | https://example.com/mouse.jpg |
| P005 | Notebook Set | 8.75 | Stationery | Set of 3 ruled notebooks with 100 pages each, perfect for school or office use. | https://example.com/notebook.jpg |

## Need Help?

If you're still experiencing issues with the Excel import feature, please contact your system administrator or refer to the detailed error messages displayed in the app. 