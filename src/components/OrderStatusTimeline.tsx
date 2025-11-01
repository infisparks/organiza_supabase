import { ShoppingCart, CreditCard, Box, Truck, MapPin } from "lucide-react"

// Define the structure of a single step in the timeline
interface TimelineStep {
    label: string
    icon: any // Using 'any' for the Lucide-React component, could also use React.ElementType
    status: string
}

// Define the props for the OrderStatusTimeline component
interface OrderStatusTimelineProps {
    currentStatus: string
}

// Timeline steps (SHARED STRUCTURE) - Must be defined here or imported
const proTimelineSteps: TimelineStep[] = [
    { label: "Order Confirmed", icon: ShoppingCart, status: "confirmed" },
    { label: "Payment Accepted", icon: CreditCard, status: "payment_accepted" },
    { label: "Order is Being Prepared", icon: Box, status: "preparing" },
    { label: "Order Has Been Shipped", icon: Truck, status: "shipped" },
    { label: "Order Successfully Delivered", icon: MapPin, status: "delivered" },
]
const statusOrder = ["confirmed", "payment_accepted", "preparing", "shipped", "delivered"]


export default function OrderStatusTimeline({ currentStatus }: OrderStatusTimelineProps) {
    const currentStatusIdx = statusOrder.indexOf(currentStatus);

    return (
        <div className="w-full flex flex-col items-center mb-4">
            <div className="flex items-center w-full justify-between px-2 overflow-x-auto pb-2">
                {proTimelineSteps.map((step, stepIdx) => {
                    const thisStepIdx = statusOrder.indexOf(step.status)
                    const isActive = thisStepIdx === currentStatusIdx
                    const isCompleted = thisStepIdx < currentStatusIdx
                    const isLast = stepIdx === proTimelineSteps.length - 1
                    const StepIcon = step.icon // Renamed for clarity

                    return (
                        <div key={step.label} className="flex flex-col items-center flex-1 min-w-[100px]">
                            <div className="relative flex flex-col items-center">
                                <div className="z-10">
                                    <StepIcon
                                        className={`h-8 w-8 p-1 rounded-full border-2 shadow-md ${
                                            isActive
                                                ? "bg-gradient-to-r from-blue-400 to-emerald-500 text-white border-blue-500" // Active/Current
                                                : isCompleted
                                                    ? "bg-emerald-500 text-white border-emerald-500" // Completed
                                                    : "bg-gray-200 text-gray-400 border-gray-300" // Inactive
                                        }`}
                                    />
                                </div>
                                {/* Connecting line - CORRECTED LOGIC AND STYLING BELOW */}
                                {!isLast && (
                                    <div
                                        className={`absolute top-1/2 left-full w-full h-1 -translate-y-1/2 z-0 transition-all duration-500 ${
                                            isCompleted
                                                ? "bg-emerald-500"
                                                : isActive
                                                    ? "bg-blue-400"
                                                    : "bg-gray-200"
                                        }`}
                                        // 💡 RE-ADDED THE CRITICAL INLINE STYLE FOR DIMENSIONS
                                        style={{ width: "100px", height: "6px" }}
                                    ></div>
                                )}
                            </div>
                            <span className={`mt-2 text-xs font-semibold text-center ${
                                isActive
                                    ? "text-blue-600"
                                    : isCompleted
                                        ? "text-emerald-600"
                                        : "text-gray-500"
                            }`} style={{ minWidth: 80 }}>{step.label}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}