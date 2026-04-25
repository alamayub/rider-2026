import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/providers.dart';

class AdminSignInPage extends HookConsumerWidget {
  const AdminSignInPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final phoneController = useTextEditingController(text: '9800000003');
    final passwordController = useTextEditingController(text: 'Pass@123');
    final loading = useState(false);
    final error = useState<String?>(null);
    final info = useState<String?>(null);

    Future<void> signIn() async {
      loading.value = true;
      error.value = null;
      info.value = null;
      try {
        await ref.read(sessionProvider.notifier).signIn(
              phone: phoneController.text.trim(),
              password: passwordController.text,
            );
      } catch (e) {
        if (e is DioException) {
          error.value = e.response?.data is Map ? (e.response?.data['error'] ?? e.message).toString() : e.message;
        } else {
          error.value = e.toString();
        }
      } finally {
        loading.value = false;
      }
    }

    Future<void> requestOtp() async {
      loading.value = true;
      error.value = null;
      info.value = null;
      try {
        await ref.read(adminApiProvider).requestOtp(phone: phoneController.text.trim());
        info.value = 'OTP request submitted. Use password sign-in or OTP endpoint externally.';
      } catch (e) {
        error.value = e.toString();
      } finally {
        loading.value = false;
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Sign In')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password'),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: loading.value ? null : signIn,
                    child: loading.value
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Sign In'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: loading.value ? null : requestOtp,
                    child: const Text('Request OTP'),
                  ),
                  if (error.value != null) ...<Widget>[
                    const SizedBox(height: 12),
                    Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  if (info.value != null) ...<Widget>[
                    const SizedBox(height: 12),
                    Text(info.value!, style: const TextStyle(color: Colors.green)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

