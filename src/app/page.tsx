import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-slate-800">Gelber Gown Gemach</CardTitle>
                    <CardDescription>SMS Booking Agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-green-100 border border-green-200 rounded-md p-4 flex items-start gap-3">
                        <div className="mt-1 bg-green-500 rounded-full p-1.5 animate-pulse">
                            <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-800">System Online</h3>
                            <p className="text-sm text-green-700 mt-1">
                                The SMS Agent is active and ready to handle booking requests.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 text-slate-600 text-sm">
                        <p><strong>Status:</strong> <span className="text-green-600">Active</span></p>
                        <p><strong>Twilio Number:</strong> +1 347-507-5981</p>
                        <p className="pt-2 text-xs text-slate-400 text-center border-t mt-4">
                            v1.0.0 • Powered by Gelber Gown Gemach
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
