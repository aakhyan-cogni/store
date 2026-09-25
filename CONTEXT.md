# Store

An online shop's back end: a catalogue people browse, a cart they fill, and the
orders those carts become.

## Language

### Catalogue

**Product**:
Something the shop sells, priced and counted.
_Avoid_: Item, SKU, article

**Category**:
A named grouping every Product belongs to exactly one of.
_Avoid_: Collection, department, tag

**Stock**:
How many units of a Product the shop can still sell.
_Avoid_: Inventory, quantity on hand, availability

**Listed**:
Whether a Product is offered for sale. Delisting hides a Product from the
catalogue and from buying without erasing it or the orders that reference it.
_Avoid_: Active, deleted, archived, soft-deleted

**Public catalogue**:
The listed Products and Categories that anyone may browse without a User
account. A Cart and every Order remain private to their owning User.
_Avoid_: Open store, guest shopping, anonymous checkout

### Buying

**Cart**:
The set of Products a User intends to buy, and how many of each. Mutable, and
carries no prices of its own.
_Avoid_: Basket, bag, pending order

**Cart item**:
One Product and a quantity within a User's Cart.
_Avoid_: Cart line, cart entry

**Checkout**:
The act of turning a User's whole Cart into one Order. It either happens
completely or not at all.
_Avoid_: Purchase, place order, buy, submit

**Order**:
The immutable record of one Checkout: what a User bought, what it cost, and
where it now stands.
_Avoid_: Purchase, transaction, receipt, sale

**Order item**:
One Product, a quantity, and a Price at purchase within an Order.
_Avoid_: Order line, line item

**Price at purchase**:
What a Product cost at the moment of Checkout, recorded on its Order item so
later price changes never rewrite what someone paid.
_Avoid_: Historical price, locked price, snapshot price

**Order status**:
Where an Order stands: awaiting payment, paid, or cancelled.
_Avoid_: State, stage, order state

**Cancellation**:
Withdrawing an Order that has not been paid, returning its Stock to the shop.
Only the User who placed an Order may cancel it.
_Avoid_: Refund, return, void, reversal

### People

**User**:
Someone with an account, who owns exactly one Cart and any number of Orders.
_Avoid_: Customer, buyer, account, shopper

**Role**:
What a User is permitted to do: keep the catalogue, or shop from it.
_Avoid_: Permission, scope, access level
