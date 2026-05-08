import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../config/extensions.dart';
import '../../providers/providers.dart';

/// Rider entry: one flow — sign in with password, or create account on first use (backend).
class RiderSignInPage extends HookConsumerWidget {
  const RiderSignInPage({super.key});

  static const String _passwordHint =
      'At least 8 characters with upper, lower, number, and a special character.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final phoneController = useTextEditingController();
    final passwordController = useTextEditingController();
    final otpController = useTextEditingController();
    final loading = useState(false);
    final info = useState<String?>(null);
    final obscurePassword = useState(true);
    final showOtpOptions = useState(false);

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    String? readError(Object e) {
      if (e is DioException) {
        final Object? data = e.response?.data;
        if (data is Map && data['error'] != null) {
          return data['error'].toString();
        }
        return e.message;
      }
      return e.toString();
    }

    Future<void> continueWithMobile() async {
      final String phone = phoneController.text.trim();
      final String password = passwordController.text;
      if (phone.isEmpty) {
        context.showAppSnackBar('Enter your mobile number.',
            type: AppSnackBarType.error);
        return;
      }
      final String o = otpController.text.trim();
      if (o.isNotEmpty) {
        if (o.length < 6) {
          context.showAppSnackBar(
            'Enter the 6-digit code.',
            type: AppSnackBarType.error,
          );
          return;
        }
      } else if (password.isEmpty) {
        context.showAppSnackBar(
          'Enter a password or use an SMS code below.',
          type: AppSnackBarType.error,
        );
        return;
      }

      loading.value = true;
      info.value = null;
      try {
        await ref.read(sessionProvider.notifier).signIn(
              phone: phone,
              password: o.isNotEmpty ? null : password,
              otp: o.isNotEmpty ? o : null,
            );
      } catch (e) {
        if (context.mounted) {
          context.showAppSnackBar(
            readError(e) ?? 'Something went wrong.',
            type: AppSnackBarType.error,
          );
        }
      } finally {
        loading.value = false;
      }
    }

    Future<void> requestOtp() async {
      final String phone = phoneController.text.trim();
      if (phone.isEmpty) {
        context.showAppSnackBar(
          'Enter your mobile number first.',
          type: AppSnackBarType.error,
        );
        return;
      }
      loading.value = true;
      info.value = null;
      try {
        await ref.read(riderApiProvider).requestOtp(phone: phone);
        info.value = 'If this number is registered, check for your code.';
      } catch (e) {
        if (context.mounted) {
          context.showAppSnackBar(
            readError(e) ?? 'Something went wrong.',
            type: AppSnackBarType.error,
          );
        }
      } finally {
        loading.value = false;
      }
    }

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              colorScheme.primary.withValues(alpha: 0.14),
              colorScheme.surface,
              colorScheme.surfaceContainerLowest,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const SizedBox(height: 12),
                    Icon(
                      Icons.directions_car_filled_rounded,
                      size: 56,
                      color: colorScheme.primary,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Continue with mobile',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'We’ll sign you in if you already have an account, or create one on first use — same password you choose here.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        height: 1.35,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 32),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        TextField(
                          controller: phoneController,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          autofillHints: const <String>[
                            AutofillHints.telephoneNumber
                          ],
                          decoration: InputDecoration(
                            labelText: 'Mobile number',
                            hintText: 'e.g. 9800000001',
                            prefixIcon: Icon(
                              Icons.phone_rounded,
                              color: colorScheme.primary,
                            ),
                            filled: true,
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: passwordController,
                          obscureText: obscurePassword.value,
                          textInputAction: TextInputAction.done,
                          autofillHints: const <String>[AutofillHints.password],
                          onSubmitted: (_) => continueWithMobile(),
                          decoration: InputDecoration(
                            labelText: 'Password',
                            hintText: 'Choose a strong password',
                            prefixIcon: Icon(Icons.lock_outline_rounded,
                                color: colorScheme.primary),
                            suffixIcon: IconButton(
                              tooltip: obscurePassword.value ? 'Show' : 'Hide',
                              onPressed: () => obscurePassword.value =
                                  !obscurePassword.value,
                              icon: Icon(
                                obscurePassword.value
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                            filled: true,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                        Padding(
                          padding:
                              const EdgeInsets.only(top: 8, left: 4, right: 4),
                          child: Text(
                            _passwordHint,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        if (showOtpOptions.value) ...<Widget>[
                          const SizedBox(height: 16),
                          TextField(
                            controller: otpController,
                            keyboardType: TextInputType.number,
                            maxLength: 6,
                            decoration: InputDecoration(
                              labelText: 'SMS code (optional)',
                              hintText: '6 digits',
                              counterText: '',
                              prefixIcon: Icon(Icons.sms_outlined,
                                  color: colorScheme.primary),
                              filled: true,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: loading.value ? null : requestOtp,
                            icon: const Icon(Icons.send_rounded, size: 20),
                            label: const Text('Send code'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: loading.value ? null : continueWithMobile,
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: loading.value
                              ? SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: colorScheme.onPrimary,
                                  ),
                                )
                              : const Text('Continue'),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: loading.value
                              ? null
                              : () {
                                  showOtpOptions.value = !showOtpOptions.value;
                                },
                          child: Text(
                            showOtpOptions.value
                                ? 'Use password only'
                                : 'Use SMS code instead',
                          ),
                        ),
                      ],
                    ),
                    if (info.value != null) ...<Widget>[
                      const SizedBox(height: 16),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer
                              .withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Icon(Icons.info_outline,
                                  color: colorScheme.onPrimaryContainer,
                                  size: 22),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  info.value!,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: colorScheme.onPrimaryContainer,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
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
