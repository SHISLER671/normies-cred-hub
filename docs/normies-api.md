# Normies API

> On-Chain Normies Data for Builders

Normies is a 10,000-piece on-chain generative NFT collection on Ethereum.
Each Normie is a 40x40 monochrome bitmap stored entirely on-chain.

## Base URL

https://api.normies.art

## Endpoints

Note: The /normie/{id}/pixels, /image.svg, /image.png, and /metadata endpoints return
composited (customized) data when a Normie has been edited via NormiesCanvas.
Use /normie/{id}/original/* endpoints to access pre-transform data.

### GET /normie/{id}/pixels
Returns the 40x40 bitmap as a 1600-character string of 0s and 1s (composited if customized).
- Content-Type: text/plain
- Parameters: id (integer, 0-9999)
- Response: 1600 characters, row-major order, top-left to bottom-right
- 1 = pixel on (dark gray #48494b), 0 = pixel off (light gray #e3e5e4)

### GET /normie/{id}/traits/binary
Returns the raw bytes8 trait data as a hex string.
- Content-Type: text/plain
- Parameters: id (integer, 0-9999)

### GET /normie/{id}/traits
Returns decoded traits as JSON with human-readable labels.
- Content-Type: application/json
- Parameters: id (integer, 0-9999)
- Trait categories: Type, Gender, Age, Hair Style, Facial Feature, Eyes, Expression, Accessory

### GET /normie/{id}/image.svg
Returns the Normie as an SVG image (composited if customized).
- Content-Type: image/svg+xml
- Parameters: id (integer, 0-9999)

### GET /normie/{id}/image.png
Returns the Normie as a 1000x1000 PNG (composited if customized).
- Content-Type: image/png
- Parameters: id (integer, 0-9999)

### GET /normie/{id}/metadata
Returns full NFT metadata JSON matching on-chain tokenURI() (V4 renderer).
Includes canvas-aware attributes: Level, Action Points, Customized.
- Content-Type: application/json
- Parameters: id (integer, 0-9999)

### GET /normie/{id}/owner
Returns the current owner of a Normie.
- Content-Type: application/json

### GET /holders/{address}
Returns all Normie token IDs owned by a wallet address.
- Content-Type: application/json

### GET /normie/{id}/original/pixels
### GET /normie/{id}/original/image.svg
### GET /normie/{id}/original/image.png
Original data endpoints (pre-Canvas edits).

### GET /normie/{id}/canvas/pixels
Transform layer (XOR overlay) as binary string.

### GET /normie/{id}/canvas/diff
Pixel-level diff between original and Canvas edits.

### GET /normie/{id}/canvas/info
Canvas metadata: action points, level, customization status, delegate info.

### GET /canvas/status
Global Canvas contract status.

### GET /history/burns
List burn commitments (paginated). Query: ?limit=50&offset=0

### GET /history/burned-tokens
List burned tokens (paginated).

### GET /history/burned/{tokenId}/image.svg
SVG image of a burned Normie.

### GET /history/normie/{id}/versions
Transform version history for a Normie.

### GET /history/normie/{id}/version/{version}/image.svg
Historical version SVG.

### GET /history/stats
Global Canvas activity statistics.

## Trait Categories
- Type: Human, Cat, Alien, Agent
- Gender: Male, Female, Non-Binary
- Age: Young, Middle-Aged, Old
- Hair Style: 21 options
- Facial Feature: 17 options
- Eyes: 14 options
- Expression: 7 options
- Accessory: 15 options

## Pixel Data Format
- Grid: 40x40 pixels (1600 total)
- 1 bit per pixel, MSB first, row-major
- Storage: 200 bytes on-chain

## Rate Limiting
60 requests per minute per IP (sliding window).
No API key required.

## Errors
- 400: Invalid token ID (must be 0-9999)
- 404: Token not found
- 429: Rate limit exceeded
- 500: Internal server error
