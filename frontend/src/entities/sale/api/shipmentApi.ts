export interface ShipmentRequest {
  saleId: string;
  serialNumbers: string[];
  warehouse: string;
  author: string;
}

export interface ShipmentResponse {
  success: boolean;
  message: string;
  shipmentId?: string;
}

// Mock API function for warehouse shipment
export const createWarehouseShipment =
  async (): Promise<ShipmentResponse> => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock success response
    if (Math.random() > 0.1) {
      // 90% success rate
      return {
        success: true,
        message: 'Shipment created successfully',
        shipmentId: `SHIP-${Date.now().toString().slice(-6)}`,
      };
    } else {
      // Mock error response
      throw new Error(
        'Failed to create shipment. Insufficient stock or invalid serial numbers.',
      );
    }
  };

// Mock function to get available serial numbers for a product
export const getAvailableSerialNumbers = async (
  productId: string,
  quantity: number,
): Promise<string[]> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate mock serial numbers
  const baseSerial = `SN-${productId.slice(-4)}`;
  const serials = [];
  for (let i = 0; i < quantity; i++) {
    serials.push(`${baseSerial}-${String(i + 1).padStart(3, '0')}`);
  }

  return serials;
};
