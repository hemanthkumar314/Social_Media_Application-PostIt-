import { z } from "zod"

export const UsernameValidation = z.string().trim().toLowerCase()
  .min(2, 'Username must be at least 2 characters.')
  .max(32, 'Username must be at most 32 characters.')
  .regex(/^[a-z0-9_]+$/, 'Use only letters, numbers, and underscores.');

export const SignupValidation = z.object({
    username: UsernameValidation,
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
    password: z.string().min(8,{message: "Password must be at least 8 characters.",}),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  }).refine(values => values.password === values.confirmPassword, {
    message: 'Passwords do not match.', path: ['confirmPassword'],
  })

export const RecoveryValidation = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
});

export const ResetPasswordValidation = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords do not match.', path: ['confirmPassword'],
});

  export const SigninValidation = z.object({
    username: UsernameValidation,
    password: z.string().min(8,{message: "Password must be at least 8 characters.",}),
  })

  export const PostValidation = z.object({
    caption: z.string().min(5).max(2200),
    file: z.array(z.custom<File>((value) => typeof File !== 'undefined' && value instanceof File, 'Please select a valid image file.'))
      .max(1, 'Please select one photo.')
      .refine((files) => files.every((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)), 'Please select a PNG, JPEG, or WebP image.')
      .refine((files) => files.every((file) => file.size <= 10 * 1024 * 1024), 'Photos must be at most 10 MiB.'),
    location: z.string().min(2).max(100),
    tags: z.string().refine(value => value.split(',').every(tag => tag.trim().length <= 64), 'Each tag must be at most 64 characters.'),
  })

  export const ProfileValidation = z.object({
    file: z.array(z.custom<File>((value) => typeof File !== 'undefined' && value instanceof File, 'Please select a valid image file.'))
      .max(1, 'Please select one profile photo.')
      .refine((files) => files.every((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)), 'Please select a PNG, JPEG, or WebP image.')
      .refine((files) => files.every((file) => file.size <= 10 * 1024 * 1024), 'Photos must be at most 10 MiB.'),
    name: z.string().trim().min(2, { message: "Name must be at least 2 characters." }).max(128),
    username: z.string().min(2, { message: "Name must be at least 2 characters." }).max(64),
    bio: z.string().max(2200),
  });
