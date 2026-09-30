// Lets Node resolve extensionless TypeScript imports, so the pure-logic tests run without a bundler.
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (e) {
    if (specifier.startsWith('.')) return next(specifier + '.ts', context)
    throw e
  }
}
