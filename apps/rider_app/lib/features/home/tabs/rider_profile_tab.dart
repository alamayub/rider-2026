import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/rider_api.dart';
import '../widgets/console_widgets.dart';

class RiderProfileTab extends HookConsumerWidget {
  const RiderProfileTab({super.key, required this.api});

  final RiderApi api;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final RiderSession? session = ref.watch(sessionProvider);
    final sessionNotifier = ref.read(sessionProvider.notifier);
    final TextEditingController fullNameController = useTextEditingController();
    final TextEditingController emailController = useTextEditingController();
    final TextEditingController currentPasswordController =
        useTextEditingController();
    final TextEditingController newPasswordController = useTextEditingController();
    final TextEditingController confirmPasswordController =
        useTextEditingController();
    final profileResult = useState<Object?>(null);
    final passwordResult = useState<Object?>(null);
    final error = useState<String?>(null);
    final loadingProfile = useState(false);
    final updatingProfile = useState(false);
    final changingPassword = useState(false);

    Future<void> loadProfile() async {
      loadingProfile.value = true;
      error.value = null;
      try {
        final result = await api.getMyProfile();
        profileResult.value = result;
        fullNameController.text = (result['fullName'] ?? '').toString();
        emailController.text = (result['email'] ?? '').toString();
      } catch (e) {
        error.value = e.toString();
      } finally {
        loadingProfile.value = false;
      }
    }

    useEffect(() {
      loadProfile();
      return null;
    }, const <Object?>[]);

    Future<void> saveProfile() async {
      if (updatingProfile.value) return;
      updatingProfile.value = true;
      error.value = null;
      try {
        final result =
            await api.updateMyProfile(
              email: emailController.text.trim(),
              fullName: fullNameController.text.trim(),
            );
        profileResult.value = result;
      } catch (e) {
        error.value = e.toString();
      } finally {
        updatingProfile.value = false;
      }
    }

    Future<void> doChangePassword() async {
      if (changingPassword.value) return;
      final String currentPassword = currentPasswordController.text;
      final String newPassword = newPasswordController.text;
      final String confirmPassword = confirmPasswordController.text;
      if (currentPassword.isEmpty || newPassword.isEmpty) {
        error.value = 'Current password and new password are required.';
        return;
      }
      if (newPassword != confirmPassword) {
        error.value = 'New password and confirm password do not match.';
        return;
      }
      changingPassword.value = true;
      error.value = null;
      try {
        passwordResult.value = await api.changePassword(
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Password changed. Please sign in again.'),
            ),
          );
        }
        sessionNotifier.signOut();
      } catch (e) {
        error.value = e.toString();
      } finally {
        changingPassword.value = false;
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Text(
          'Profile',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Phone'),
          subtitle: Text(session?.phone ?? '-'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: fullNameController,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Full name'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: <Widget>[
            OutlinedButton(
              onPressed: loadingProfile.value ? null : loadProfile,
              child: Text(loadingProfile.value ? 'Refreshing...' : 'Refresh'),
            ),
            ElevatedButton(
              onPressed: updatingProfile.value ? null : saveProfile,
              child: Text(updatingProfile.value ? 'Saving...' : 'Save profile'),
            ),
          ],
        ),
        const Divider(height: 28),
        Text(
          'Change password',
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: currentPasswordController,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Current password'),
        ),
        TextField(
          controller: newPasswordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'New password',
            hintText: '8+ chars with upper, lower, number, special',
          ),
        ),
        TextField(
          controller: confirmPasswordController,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Confirm new password'),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: changingPassword.value ? null : doChangePassword,
          child: Text(
              changingPassword.value ? 'Changing...' : 'Change password'),
        ),
        if (error.value != null) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            error.value!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        if (profileResult.value != null) ...<Widget>[
          const SizedBox(height: 12),
          RiderJsonPanel(title: 'Profile', data: profileResult.value),
        ],
        if (passwordResult.value != null) ...<Widget>[
          const SizedBox(height: 12),
          RiderJsonPanel(title: 'Password update', data: passwordResult.value),
        ],
      ],
    );
  }
}
