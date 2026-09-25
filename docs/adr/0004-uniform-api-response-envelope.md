# Uniform API response envelope

The client-facing API will return successful JSON as `{ data, meta? }` and failures as `{ error: { code, message, details? } }`. This is a breaking change, made before known external clients exist, so a storefront can use one consistent parsing and error-handling path while collection responses retain room for pagination metadata.
