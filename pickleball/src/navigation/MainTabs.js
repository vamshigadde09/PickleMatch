import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen.js';
import TopScoreScreen from '../screens/TopScoreScreen.js';
import ProfileScreen from '../screens/ProfileScreen.js';
import { palette } from '../theme/colors.js';

const Tab = createBottomTabNavigator();

// Active color (green)
const activeColor = '#22c55e';
// Inactive color (muted gray-green)
const inactiveColor = '#9ca3af';

const TabIcon = ({ name, focused, iconName }) => (
    <Feather
        name={iconName}
        size={24}
        color={focused ? activeColor : inactiveColor}
        style={styles.tabIcon}
    />
);

const TabLabel = ({ title, focused }) => (
    <Text
        style={[
            styles.tabLabel,
            { color: focused ? activeColor : inactiveColor }
        ]}
    >
        {title}
    </Text>
);

export const MainTabs = () => {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: palette.card,
                    borderTopWidth: 1,
                    borderTopColor: palette.border,
                    height: 70 + insets.bottom,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 10),
                    elevation: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                },
                tabBarActiveTintColor: activeColor,
                tabBarInactiveTintColor: inactiveColor,
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                    marginTop: 4,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon name="Home" focused={focused} iconName="home" />
                    ),
                    tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Home" />,
                }}
            />
            <Tab.Screen
                name="Scores"
                component={TopScoreScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon name="Scores" focused={focused} iconName="award" />
                    ),
                    tabBarLabel: ({ focused }) => (
                        <TabLabel focused={focused} title="Top Scores" />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon name="Profile" focused={focused} iconName="user" />
                    ),
                    tabBarLabel: ({ focused }) => (
                        <TabLabel focused={focused} title="Profile" />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    tabIcon: {
        marginBottom: 2,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
});

export default MainTabs;

