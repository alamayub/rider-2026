import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../core/providers.dart';

class RiderSignInPage extends HookConsumerWidget {
  const RiderSignInPage({super.key});

  static const String _passwordRules =
      'Use at least 8 characters with uppercase, lowercase, a number, and a special character.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isRegister = useState(false);
    final phoneController = useTextEditingController(text: '9800000001');
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController(text: 'Pass@123');
    final otpController = useTextEditingController();
    final loading = useState(false);
    final error = useState<String?>(null);
    final info = useState<String?>(null);

    String? readError(Object e) {
      if (e is DioException) {
        return e.response?.data is Map ? (e.response?.data['error'] ?? e.message).toString() : e.message;
      }
      return e.toString();
    }

    Future<void> signIn() async {
      loading.value = true;
      error.value = null;
      info.value = null;
      try {
        final o = otpController.text.trim();
        await ref.read(sessionProvider.notifier).signIn(
              phone: phoneController.text.trim(),
              password: o.isNotEmpty ? null : passwordController.text,
              otp: o.isNotEmpty ? o : null,
            );
      } catch (e) {
        error.value = readError(e);
      } finally {
        loading.value = false;
      }
    }

    Future<void> register() async {
      loading.value = true;
      error.value = null;
      info.value = null;
      try {
        await ref.read(sessionProvider.notifier).register(
              phone: phoneController.text.trim(),
              password: passwordController.text,
              email: emailController.text.trim(),
            );
      } catch (e) {
        error.value = readError(e);
      } finally {
        loading.value = false;
      }
    }

    Future<void> requestOtp() async {
      loading.value = true;
      error.value = null;
      info.value = null;
      try {
        await ref.read(riderApiProvider).requestOtp(phone: phoneController.text.trim());
        info.value = 'OTP request submitted.';
      } catch (e) {
        error.value = readError(e);
      } finally {
        loading.value = false;
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(isRegister.value ? 'Rider — Create account' : 'Rider — Sign in')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
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
                    if (isRegister.value) ...<Widget>[
                      const SizedBox(height: 12),
                      TextField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email (optional)',
                          hintText: 'you@example.com',
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password'),
                    ),
                    if (isRegister.value) ...<Widget>[
                      const SizedBox(height: 8),
                      Text(_passwordRules, style: Theme.of(context).textTheme.bodySmall),
                    ],
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: loading.value ? null : (isRegister.value ? register : signIn),
                      child: loading.value
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(isRegister.value ? 'Create account' : 'Sign in'),
                    ),
                    if (!isRegister.value) ...<Widget>[
                      const SizedBox(height: 8),
                      TextField(
                        controller: otpController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: 'One-time code (after Request OTP)',
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: loading.value ? null : requestOtp,
                        child: const Text('Request OTP'),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: loading.value
                          ? null
                          : () {
                              isRegister.value = !isRegister.value;
                              error.value = null;
                              info.value = null;
                            },
                      child: Text(
                        isRegister.value ? 'Already have an account? Sign in' : 'New rider? Create an account',
                      ),
                    ),
                    if (info.value != null) ...<Widget>[
                      const SizedBox(height: 8),
                      Text(info.value!, style: const TextStyle(color: Colors.green)),
                    ],
                    if (error.value != null) ...<Widget>[
                      const SizedBox(height: 8),
                      Text(error.value!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
