"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "../../lib/supabase"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import OrderStatusTimeline from "@/components/OrderStatusTimeline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShoppingBag, Phone, CalendarDays, Search, CreditCard, Utensils, Truck, CheckCheck, ShoppingCart, Box, MapPin, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import Chart from "react-apexcharts" // Not strictly needed here, but kept for consistency

// Define the structure of an item within the order_items JSONB array
interface OrderItemJson {
    id: string
    product_id: string
    quantity: number
    price_at_purchase: number
    created_at: string
}

// Define the structure of an order item with product details
interface ProductDetailsForOrder {
    id: string
    product_name: string
    product_photo_urls: string[]
}

interface OrderItemWithProduct extends OrderItemJson {
    products: ProductDetailsForOrder | null
}

interface Order {
    id: string
    total_amount: number
    status: string
    purchase_time: string
    customer_name: string
    primary_phone: string
    secondary_phone: string | null
    country: string
    state: string
    city: string
    pincode: string
    area: string | null
    street: string | null
    house_number: string | null
    order_items: OrderItemJson[]
    resolved_order_items?: OrderItemWithProduct[]
}

const getStatusBadgeClass = (status: string) => {
    switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-700";
        case "confirmed": return "bg-blue-100 text-blue-700";
        case "payment_accepted": return "bg-green-100 text-green-700";
        case "preparing": return "bg-yellow-100 text-yellow-700";
        case "shipped": return "bg-purple-100 text-purple-700";
        case "delivered": return "bg-green-100 text-green-700";
        case "cancelled": return "bg-red-100 text-red-700";
        default: return "bg-gray-100 text-gray-700";
    }
};

export default function MyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const router = useRouter()
    const { toast } = useToast()

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        setError(null)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
            toast({ title: "Authentication Required", description: "Please log in to view your orders.", variant: "destructive" })
            router.push("/login")
            return
        }

        const userId = session.user.id

        // Fetch orders, including the order_items JSONB column
        const { data: ordersData, error: ordersError } = await supabase
            .from("orders")
            .select(
                `id, total_amount, status, purchase_time, customer_name, primary_phone, secondary_phone, country, state, city, pincode, area, street, house_number, order_items`
            )
            .eq("user_id", userId)
            .order("purchase_time", { ascending: false })

        if (ordersError) {
            console.error("Error fetching orders:", ordersError)
            setError("Failed to load orders. Please try again.")
            setOrders([])
            setLoading(false)
            return
        }

        if (!ordersData || ordersData.length === 0) {
            setOrders([])
            setLoading(false)
            return
        }

        // Extract all unique product_ids from all orders' order_items
        const allProductIds = new Set<string>()
        ordersData.forEach((order) => {
            if (Array.isArray(order.order_items)) {
                order.order_items.forEach((item: OrderItemJson) => {
                    allProductIds.add(item.product_id)
                })
            }
        })

        const productsMap = new Map<string, any>()
        if (allProductIds.size > 0) {
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("id, product_name, product_photo_urls")
                .in("id", Array.from(allProductIds))

            if (productsError) {
                console.error("Error fetching product details for orders:", productsError)
            } else if (productsData) {
                productsData.forEach((product) => {
                    productsMap.set(product.id, product)
                })
            }
        }

        // Map product details back to each order's items
        const resolvedOrders: Order[] = ordersData.map((order) => {
            const resolvedItems: OrderItemWithProduct[] = Array.isArray(order.order_items)
                ? order.order_items.map((item: OrderItemJson) => ({
                    ...item,
                    products: productsMap.get(item.product_id) || null,
                }))
                : []
            return {
                ...order,
                resolved_order_items: resolvedItems,
            }
        })

        setOrders(resolvedOrders)
        setLoading(false)
    }, [router, toast])

    useEffect(() => {
        fetchOrders()

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) { router.push("/login") } else { fetchOrders() }
        })
        
        // 🎯 Real-time listener for orders table to update status instantly
        const orderChannel = supabase.channel('customer_order_status').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                // Check if the update belongs to one of the user's fetched orders
                const updatedStatus = payload.new.status as string;
                const updatedId = payload.new.id as string;
                
                setOrders(prevOrders => prevOrders.map(order => 
                    order.id === updatedId ? { ...order, status: updatedStatus } : order
                ));
            }
        ).subscribe();

        return () => {
            authListener.subscription.unsubscribe();
            supabase.removeChannel(orderChannel);
        }
    }, [fetchOrders, router])

    const filteredOrders = orders.filter((order) => {
        const matchesSearchTerm =
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.primary_phone.includes(searchTerm) ||
            order.resolved_order_items?.some((item) =>
                item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        return matchesSearchTerm
    })

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header showSearchBar={false} />
                <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-lg text-blue-700">Loading your orders...</span>
                </main>
                <Footer />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header showSearchBar={false} />
                <main className="flex-grow container mx-auto px-4 py-8">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header showSearchBar={false} />
            <main className="flex-grow container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-900">My Orders</h1>

                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        type="text"
                        placeholder="Search orders by ID, product name, or customer name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-green-500 focus:border-green-500"
                    />
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <ShoppingBag className="w-20 h-20 mb-4 text-gray-300" />
                        <p className="text-xl font-medium mb-2">No orders found.</p>
                        <p className="text-md mb-6">Try adjusting your search or start exploring our products!</p>
                        <Button asChild>
                            <Link href="/shop">Start Shopping</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredOrders.map((order) => (
                            <Card key={order.id} className="shadow-xl rounded-2xl border-0 bg-white hover:scale-[1.01] transition-transform duration-300">
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <div>
                                        <CardTitle className="text-xl font-bold">Order #{order.id.substring(0, 8)}</CardTitle>
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                            <CalendarDays className="w-4 h-4" />
                                            {new Date(order.purchase_time).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                    <Badge className={`px-3 py-1 text-sm font-medium ${getStatusBadgeClass(order.status)}`}>
                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    
                                    {/* 🎯 CUSTOMER STATUS TIMELINE - NOW USING COMPONENT */}
                                    <OrderStatusTimeline currentStatus={order.status} />
                                    {/* END CUSTOMER STATUS TIMELINE */}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Order Summary */}
                                        <div className={`space-y-2 bg-gray-50 rounded-xl shadow-sm p-4`}>
                                            <h3 className="font-semibold text-gray-800">Total Order Value</h3>
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span>Total Items:</span>
                                                <span>{order.resolved_order_items?.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg font-bold text-gray-900">
                                                <span>Amount Paid:</span>
                                                <span>₹{order.total_amount.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        {/* Shipping Address */}
                                        <div className={`space-y-2 bg-gray-50 rounded-xl shadow-sm p-4`}>
                                            <h3 className="font-semibold text-gray-800">Shipping To</h3>
                                            <p className="text-sm text-gray-600">
                                                {order.customer_name}<br />
                                                {order.house_number}, {order.street}<br />
                                                {order.area}, {order.city} - {order.pincode}<br />
                                                {order.state}, {order.country}
                                            </p>
                                            <p className="text-sm text-gray-600 flex items-center gap-1">
                                                <Phone className="w-4 h-4" /> {order.primary_phone}
                                                {order.secondary_phone && `, ${order.secondary_phone}`}
                                            </p>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Ordered Products */}
                                    <h3 className="font-semibold text-gray-800">Products in this Order</h3>
                                    <div className="space-y-3">
                                        {order.resolved_order_items?.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-4 p-2 border-b last:border-b-0">
                                                <Link href={`/product/${item.product_id}`} className="flex items-center gap-3 group">
                                                    <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
                                                        <Image src={item.products?.product_photo_urls?.[0] || "/placeholder.svg"} alt={item.products?.product_name || "Product Image"} fill sizes="64px" className="object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-md font-medium text-gray-900 line-clamp-1 group-hover:text-blue-600">{item.products?.product_name || "Unknown Product"}</p>
                                                        <p className="text-sm text-gray-600">
                                                            ₹{item.price_at_purchase.toFixed(2)} x {item.quantity}
                                                        </p>
                                                    </div>
                                                </Link>
                                                {/* Product Amount and Button Container */}
                                                <div className="flex flex-col items-end space-y-2">
                                                    <span className="font-semibold text-gray-900 whitespace-nowrap">
                                                        ₹{(item.price_at_purchase * item.quantity).toFixed(2)}
                                                    </span>
                                                    {/* 💡 NEW BUTTON ADDED HERE */}
                                                    <Button asChild variant="outline" size="sm" className="h-8 text-xs px-2">
                                                        <Link href={`/product/${item.product_id}`} className="flex items-center gap-1">
                                                            <Eye className="w-3 h-3" />
                                                            View Product
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    )
}