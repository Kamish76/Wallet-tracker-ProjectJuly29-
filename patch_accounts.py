import re

def fix_accounts(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add ActivityIndicator import
    content = content.replace(
        "ScrollView,\n  TouchableOpacity,\n  Modal,\n  TextInput,\n  Alert,\n  StyleSheet,\n} from 'react-native';",
        "ScrollView,\n  TouchableOpacity,\n  Modal,\n  TextInput,\n  Alert,\n  StyleSheet,\n  ActivityIndicator,\n} from 'react-native';"
    )

    # Add isLoading state
    content = content.replace(
        "const [saving, setSaving] = useState(false);",
        "const [saving, setSaving] = useState(false);\n  const [isLoading, setIsLoading] = useState(true);"
    )

    # Fix loadLocalAccounts
    content = content.replace(
        "const withBalances = await OfflineDatabase.getAccountsWithBalances(organizationId, archived);\n    setAccounts(withBalances);",
        "const withBalances = await OfflineDatabase.getAccountsWithBalances(organizationId, archived);\n    setAccounts(withBalances);\n    setIsLoading(false);"
    )

    # Fix JSX for Accounts List
    jsx_replacement = """      {/* Accounts List */}
      <ScrollView style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : accounts.length === 0 ? ("""
    
    content = content.replace(
        "      {/* Accounts List */}\n      <ScrollView style={styles.listContainer}>\n        {accounts.length === 0 ? (",
        jsx_replacement
    )

    # Fix hardcoded colors in deleteButton styles
    content = content.replace(
        "backgroundColor: 'rgba(255, 82, 82, 0.1)',",
        "backgroundColor: Colors.errorBg,"
    ).replace(
        "borderColor: 'rgba(255, 82, 82, 0.3)',",
        "borderColor: Colors.errorBorder,"
    )

    with open(filepath, 'w') as f:
        f.write(content)

fix_accounts('src/app/(tabs)/accounts.tsx')
