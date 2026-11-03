
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";

export default function NetworkGuard({ children }) {
    const [networkStatus, setNetworkStatus] = useState("checking");

    useEffect(() => {
        let mounted = true;

        const checkNetwork = (state) => {
            const offline =
                state.isConnected === false ||
                state.isInternetReachable === false;

            if (mounted) {
                setNetworkStatus(offline ? "offline" : "online");
            }
        };

        NetInfo.fetch()
            .then(checkNetwork)
            .catch(() => {
                if (mounted) setNetworkStatus("offline");
            });

        const unsubscribe = NetInfo.addEventListener(checkNetwork);

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    if (networkStatus === "checking") {
        return <View style={styles.container} />;
    }

    if (networkStatus === "offline") {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>
                    Turn on mobile data to use Sparsh.
                </Text>
            </View>
        );
    }

    return children;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
        padding: 25,
    },
    message: {
        color: "#000000",
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
    },
});
