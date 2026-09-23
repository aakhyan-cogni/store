# Orders stop at awaiting-payment; nothing may mark one paid

There is no payment gateway, so no code path sets an Order's status to paid —
the value exists in the schema, but the only transition the API admits is the
buyer cancelling their own unpaid Order. Accepting a client-supplied "paid"
status would make the shop's records claim money had changed hands when it
hadn't, which is worse than having no payment story at all. The gap is
deliberate: wiring in a gateway means adding the transition, not relaxing the
check.
