const maria = require('../config/maria');
const Product = require('../models/product/product');               // 상품 모델
const ProductVariant = require('../models/product/productvariant'); // 옵션 모델
const Inventory = require('../models/product/inventory');           // 재고 모델
const { literalSearch } = require('../utils/input');
const { enrichProductForResponse } = require('../utils/productPricing');
const { sortVariants } = require('../utils/variantOrder');

const PRODUCT_CATEGORIES = ['인형·키링', '리빙', '문구·데스크', '의류'];
const STANDARD_SIZES = ['프리', 'S', 'M', 'L', 'XL'];

function parseOptionalEventDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw Object.assign(new Error('이벤트 날짜 형식이 올바르지 않습니다.'), { status: 400 });
  }
  return d;
}

function duplicateKeyMessage(error) {
  if (error?.code !== 11000 && error?.errno !== 1062) return null;
  const text = String(error.message || '');
  if (/products|productCode/i.test(text)) {
    return '이미 사용 중인 상품 코드입니다. 다른 코드를 쓰거나, 목록에서 기존 상품을 수정·삭제해주세요.';
  }
  if (/productvariants|variantCode/i.test(text)) {
    return '이미 사용 중인 옵션(색상) 코드입니다.';
  }
  if (/inventories|sku/i.test(text)) {
    return '이미 사용 중인 SKU(사이즈) 코드입니다.';
  }
  return '이미 등록된 코드가 있어 저장할 수 없습니다.';
}

function normalizeVariantCode(productCode, variant) {
  return (variant.variantCode || `${productCode}-${variant.color}`)
    .toUpperCase()
    .replace(/\s/g, '');
}

async function assertNewProductCodes(session, productCode, variants = []) {
  const code = String(productCode || '').trim();
  if (!code) {
    throw Object.assign(new Error('상품 코드는 필수입니다.'), { status: 400 });
  }
  const existingProduct = await Product.findOne({ productCode: code }).session(session);
  if (existingProduct) {
    throw Object.assign(new Error(`상품 코드 "${code}"는 이미 사용 중입니다.`), { status: 409 });
  }
  const seenVariants = new Set();
  for (const variant of variants) {
    const vCode = normalizeVariantCode(code, variant);
    if (seenVariants.has(vCode)) {
      throw Object.assign(new Error(`옵션 코드 "${vCode}"가 이 상품 안에서 중복되었습니다.`), { status: 400 });
    }
    seenVariants.add(vCode);
    const existingVariant = await ProductVariant.findOne({ variantCode: vCode }).session(session);
    if (existingVariant) {
      throw Object.assign(new Error(`옵션 코드 "${vCode}"는 이미 다른 상품에서 사용 중입니다.`), { status: 409 });
    }
  }
}

function applyProductPayloadToDoc(product, productData) {
  const editable = [
    'name', 'category', 'basePrice', 'discountRate', 'description', 'material',
    'origin', 'careInstructions', 'status', 'priceMode'
  ];
  for (const field of editable) {
    if (Object.hasOwn(productData, field)) product.set(field, productData[field]);
  }
  for (const field of ['eventDiscountStart', 'eventDiscountEnd']) {
    if (Object.hasOwn(productData, field)) product.set(field, parseOptionalEventDate(productData[field]));
  }
}

// [POST] 상품(Product) + 옵션(Variant) + 재고(Inventory) + 이미지 전체 등록
// 트랜잭션을 사용하여 중간 실패 시 전체 롤백 처리
exports.createFullProduct = async (req, res) => {
    const session = await maria.startSession();  // 세션 생성
    await session.startTransaction();                     // 트랜잭션 시작

    try {
        let productData, variants;

        // 요청 데이터 파싱 (form-data 또는 json)
        if (typeof req.body.data === 'string') {
            // Multer(form-data)를 통해 문자열로 들어온 경우
            const parsed = JSON.parse(req.body.data);
            productData = parsed.productData;
            variants = parsed.variants;
        } else if (req.body.productData) {
            // JSON 객체 그대로 들어온 경우 (이미지 업로드 불가한 상황)
            productData = req.body.productData;
            variants = req.body.variants;
        } else {
            throw new Error("전송된 데이터 형식이 올바르지 않습니다.");
        }

        if (!Array.isArray(variants) || variants.length === 0) {
            throw Object.assign(new Error('색상·사이즈 옵션을 1개 이상 등록해주세요.'), { status: 400 });
        }

        const productCode = String(productData.productCode || '').trim();
        await assertNewProductCodes(session, productCode, variants);

        // Product 생성
        const product = new Product({});
        applyProductPayloadToDoc(product, productData);
        product.set('productCode', productCode);
        await product.save({ session });

        // 공통 이미지 추출
        const commonThumb = (req.files || []).find(f => f.fieldname === 'common_thumb')?.path || "";
        const commonGallery = (req.files || []).filter(f => f.fieldname === 'common_gallery').map(f => f.path);
        
        // Variant 및 Inventory 생성
        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            
            // 옵션별 썸네일, 갤러리
            const vThumb = (req.files || []).find(f => f.fieldname === `variant_${i}_thumb`)?.path || commonThumb;
            const vGallery = (req.files || []).filter(f => f.fieldname === `variant_${i}_gallery`).map(f => f.path);
            const finalGallery = vGallery.length > 0 ? vGallery : commonGallery;

            // 옵션 코드 생성 (대문자 + 공백 제거)
            const vCode = normalizeVariantCode(productCode, v);
            // Variant 저장
            const newVariant = new ProductVariant({
                productId: product._id,
                variantCode: vCode,
                color: v.color,
                images: {
                    thumbnail: vThumb,
                    gallery: finalGallery
                }
            });
            await newVariant.save({ session });

            // Inventory(재고) 저장
            if (v.sizes && v.sizes.length > 0) {
                const inventoryItems = v.sizes.map(s => ({
                    variantId: newVariant._id,
                    sku: `${vCode}-${s.size}`.toUpperCase().replace(/\s/g, ''),
                    size: s.size,
                    stockQuantity: s.stockQuantity
                }));
                await Inventory.insertMany(inventoryItems, { session });
            }
        }

        await session.commitTransaction();  // 모든 작업 성공 시 커밋
        res.status(201).json({ message: "상품 등록 성공", productId: product._id });

    } catch (error) {
        await session.abortTransaction();   // 오류 발생 시 전체 롤백
        const dup = duplicateKeyMessage(error);
        const status = error.status || (dup ? 409 : 500);
        const message = dup || (error.status ? error.message : '등록 중 오류가 발생했습니다.');
        res.status(status).json({ message });
    } finally {
        await session.endSession();               // 세션 종료
    }
};

// [GET] 전체 상품 목록 조회
exports.getAllProducts = async (req, res) => {
    try {
        const { search } = req.query; // URL에서 ?search=키워드 추출
        let query = { isDeleted: false };

        // 검색어가 있으면 검색 조건을 query 객체에 추가
        if (search !== undefined && search !== null && String(search).trim()) {
            const keyword = literalSearch(String(search).trim());
            if (keyword === null) return res.status(400).json({ message: '검색어는 100자 이하의 문자열이어야 합니다.' });
            query.$or = [
                { "name.ko": { $regex: keyword, $options: 'i' } },
                { "name.en": { $regex: keyword, $options: 'i' } },
                { category: { $regex: keyword, $options: 'i' } },
                { productCode: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
            ];
        }

        // 검색 조건이 반영된 query로 상품 조회 (중복 선언 제거됨)
        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // 연관 데이터(Variant, Inventory) 추출 및 조립
        const productIds = products.map(p => p._id);
        const allVariants = await ProductVariant.find({ productId: { $in: productIds } }).lean();
        const variantIds = allVariants.map(v => v._id);
        const allInventories = await Inventory.find({ variantId: { $in: variantIds } }).lean();

        const fullProducts = products.map(p => {
            const variants = sortVariants(p.productCode, allVariants
                .filter(v => v.productId.toString() === p._id.toString() && !v.isDeleted)
                .map(v => ({
                    ...v,
                    inventories: allInventories.filter(i => i.variantId.toString() === v._id.toString() && !i.isDeleted)
                })));

            const thumbnail = variants.length > 0 ? variants[0].images.thumbnail : "";

            return {
                ...enrichProductForResponse(p),
                thumbnail,
                variants
            };
        });

        res.set?.('Cache-Control', 'no-store');
        res.status(200).json({
            success: true,
            count: fullProducts.length,
            products: fullProducts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "조회 중 오류 발생", error: error.message });
    }
};

// [GET] 상품 상세 조회 (Product + Variants + Inventory)
exports.getProductDetail = async (req, res) => {
    try {
        const { id } = req.params;

        // Product 조회
        const product = await Product.findOne({ productCode: id }).lean();

        // 존재하지 않거나 삭제된 상품 처리
        if (!product || product.isDeleted) {
            return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
        }

        // Variants 조회
        const variants = await ProductVariant.find({ productId: product._id, isDeleted: false }).lean();
        const inventories = await Inventory.find({ variantId: { $in: variants.map(v => v._id) }, isDeleted: false }).lean();
        const variantsWithInventory = sortVariants(product.productCode, variants.map(v => ({ ...v, inventory: inventories.filter(i => String(i.variantId) === String(v._id)) })));

        res.status(200).json({
            product: enrichProductForResponse(product),
            variants: variantsWithInventory
        });
        
    } catch (error) {
        res.status(500).json({ message: "상세 조회 중 오류 발생", error: error.message });
    }
};

// [PATCH] 상품 수정 (Product + Variant + Inventory)
exports.updateProduct = async (req, res) => {
    const session = await maria.startSession();
    await session.startTransaction();

    try {
        const { id } = req.params;
        let productData, variants;

        // 요청 데이터 파 (JSON vs FormData 대응)
        if (req.body.data) {
            const parsed = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            productData = parsed.productData;
            variants = parsed.variants;
        } else {
            productData = req.body.productData;
            variants = req.body.variants;
        }

        // 데이터가 없는 경우 예외 처리
        if (!productData) {
            throw new Error("수정할 상품 데이터(productData)가 누락되었습니다.");
        }

        // Product 기본 정보 업데이트 (Pre-save 훅 실행을 위해 find + save 사용)
        const product = await Product.findById(id).session(session);
        if (!product) throw new Error("상품을 찾을 수 없습니다.");

        const allowedCategories = new Set(PRODUCT_CATEGORIES);
        if (product.category) allowedCategories.add(product.category);
        if (productData.category != null && !allowedCategories.has(productData.category)) {
            throw Object.assign(new Error('카테고리는 인형·키링, 리빙, 문구·데스크, 의류 중에서 선택해주세요.'), { status: 400 });
        }

        applyProductPayloadToDoc(product, productData);
        await product.save({ session });

        const submitted = Array.isArray(variants) ? variants : [];
        const seenVariantIds = new Set();

        const markVariantDeleted = async (existingVariant) => {
            existingVariant.isDeleted = true;
            await existingVariant.save({ session });
            const rows = await Inventory.find({ variantId: existingVariant._id }).session(session);
            for (const row of rows) {
                if (row.isDeleted) continue;
                row.isDeleted = true;
                await row.save({ session });
            }
        };

        for (let i = 0; i < submitted.length; i++) {
            const v = submitted[i];
            if (v._id) {
                const existingVariant = await ProductVariant.findOne({ _id: v._id, productId: product._id }).session(session);
                if (!existingVariant) throw Object.assign(new Error('상품 옵션을 찾을 수 없습니다.'), { status: 404 });
                seenVariantIds.add(String(existingVariant._id));
                if (v.isDeleted) {
                    await markVariantDeleted(existingVariant);
                    continue;
                }
                await applyVariantEdit(existingVariant, v, i);
            } else if (!v.isDeleted) {
                await createOrReviveVariant(v, i);
            }
        }

        const activeVariants = await ProductVariant.find({ productId: product._id, isDeleted: false }).session(session);
        for (const row of activeVariants) {
            if (!seenVariantIds.has(String(row._id))) await markVariantDeleted(row);
        }
        if ((await ProductVariant.find({ productId: product._id, isDeleted: false }).session(session)).length === 0) {
            throw Object.assign(new Error('색상 옵션은 하나 이상 남겨주세요.'), { status: 400 });
        }

        async function applyVariantEdit(existingVariant, v, index) {
            const color = String(v.color ?? '').trim() || existingVariant.color;
            if (!color) throw Object.assign(new Error('색상명을 입력해주세요.'), { status: 400 });
            const files = req.files || [];
            const newThumb = files.find(f => f.fieldname === `variant_${index}_thumb`);
            const addedGallery = files.filter(f => f.fieldname === `variant_${index}_gallery`).map(f => f.path);

            const previousGallery = Array.isArray(existingVariant.images?.gallery) ? existingVariant.images.gallery : [];
            let gallery = previousGallery;
            if (Array.isArray(v.keepGallery)) {
                const allowed = new Set(previousGallery);
                gallery = v.keepGallery.filter(path => typeof path === 'string' && allowed.has(path));
            }
            gallery = [...gallery, ...addedGallery];
            if (gallery.length > 8) throw Object.assign(new Error('갤러리는 8장까지 등록할 수 있습니다.'), { status: 400 });

            if (!existingVariant.images) existingVariant.images = { thumbnail: '', gallery: [] };
            if (newThumb) existingVariant.images.thumbnail = newThumb.path;
            if (!existingVariant.images.thumbnail) throw Object.assign(new Error('대표 이미지가 필요합니다.'), { status: 400 });
            if (Array.isArray(v.keepGallery) || addedGallery.length) existingVariant.images.gallery = gallery;

            if (v.variantCode || v.color) {
                const nextCode = normalizeVariantCode(product.productCode, {
                    variantCode: v.variantCode || existingVariant.variantCode,
                    color
                });
                if (nextCode !== existingVariant.variantCode) {
                    const clash = await ProductVariant.findOne({ variantCode: nextCode }).session(session);
                    if (clash && String(clash._id) !== String(existingVariant._id)) {
                        throw Object.assign(new Error(`옵션 코드 "${nextCode}"는 이미 사용 중입니다.`), { status: 409 });
                    }
                    existingVariant.variantCode = nextCode;
                }
            }
            existingVariant.color = color;
            existingVariant.isDeleted = false;
            await existingVariant.save({ session });
            await syncInventories(existingVariant, v.inventories);
        }

        async function createOrReviveVariant(v, index) {
            const color = String(v.color || '').trim();
            const vCode = normalizeVariantCode(product.productCode, { variantCode: v.variantCode, color });
            const files = req.files || [];
            const newThumb = files.find(f => f.fieldname === `variant_${index}_thumb`);
            const addedGallery = files.filter(f => f.fieldname === `variant_${index}_gallery`).map(f => f.path);
            if (!newThumb) throw Object.assign(new Error('추가한 색상에는 대표 이미지가 필요합니다.'), { status: 400 });
            if (addedGallery.length > 8) throw Object.assign(new Error('갤러리는 8장까지 등록할 수 있습니다.'), { status: 400 });

            let existingVariant = await ProductVariant.findOne({ variantCode: vCode, productId: product._id }).session(session);
            if (existingVariant && !existingVariant.isDeleted) {
                throw Object.assign(new Error(`옵션 코드 "${vCode}"는 이미 사용 중입니다.`), { status: 409 });
            }
            const foreign = await ProductVariant.findOne({ variantCode: vCode }).session(session);
            if (foreign && String(foreign.productId) !== String(product._id)) {
                throw Object.assign(new Error(`옵션 코드 "${vCode}"는 이미 다른 상품에서 사용 중입니다.`), { status: 409 });
            }
            if (!existingVariant) {
                existingVariant = new ProductVariant({
                    productId: product._id,
                    variantCode: vCode,
                    color,
                    images: { thumbnail: newThumb.path, gallery: addedGallery }
                });
            } else {
                existingVariant.isDeleted = false;
                existingVariant.color = color;
                existingVariant.images.thumbnail = newThumb.path;
                existingVariant.images.gallery = addedGallery;
            }
            await existingVariant.save({ session });
            seenVariantIds.add(String(existingVariant._id));
            await syncInventories(existingVariant, v.inventories);
        }

        async function syncInventories(existingVariant, inventories) {
            const rows = Array.isArray(inventories) ? inventories : [];
            const knownSizes = new Set((await Inventory.find({ variantId: existingVariant._id }).session(session)).map(row => row.size));
            const touched = new Set();
            const activeSizes = rows.filter(inv => !inv.isDeleted);
            if (activeSizes.length === 0) throw Object.assign(new Error('사이즈는 하나 이상 남겨주세요.'), { status: 400 });

            for (const inv of rows) {
                const size = String(inv.size || '').trim();
                if (!STANDARD_SIZES.includes(size) && !knownSizes.has(size)) {
                    throw Object.assign(new Error('사이즈는 프리, S, M, L, XL 또는 기존 사이즈만 사용할 수 있습니다.'), { status: 400 });
                }
                if (inv.isDeleted) {
                    if (!inv._id) continue;
                    if (typeof inv.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(inv.expectedUpdatedAt))) {
                        throw Object.assign(new Error('최신 상품 정보를 다시 불러온 뒤 저장해주세요.'), { status: 409 });
                    }
                    const updated = await Inventory.findOneAndUpdate(
                        { _id: inv._id, variantId: existingVariant._id, updatedAt: new Date(inv.expectedUpdatedAt) },
                        { isDeleted: true },
                        { session }
                    );
                    if (!updated) throw Object.assign(new Error('재고가 변경되었습니다. 상품을 다시 불러온 뒤 수정해주세요.'), { status: 409 });
                    touched.add(String(inv._id));
                    continue;
                }
                if (!Number.isSafeInteger(Number(inv.stockQuantity)) || Number(inv.stockQuantity) < 0) {
                    throw Object.assign(new Error('재고는 0 이상의 정수여야 합니다.'), { status: 400 });
                }
                const newSku = `${existingVariant.variantCode}-${size}`.toUpperCase().replace(/\s/g, '');
                if (inv._id) {
                    if (typeof inv.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(inv.expectedUpdatedAt))) {
                        throw Object.assign(new Error('최신 상품 정보를 다시 불러온 뒤 저장해주세요.'), { status: 409 });
                    }
                    const updatedInventory = await Inventory.findOneAndUpdate(
                        { _id: inv._id, variantId: existingVariant._id, updatedAt: new Date(inv.expectedUpdatedAt) },
                        { stockQuantity: Number(inv.stockQuantity), sku: newSku, size, isDeleted: false },
                        { session, runValidators: true }
                    );
                    if (!updatedInventory) throw Object.assign(new Error('재고가 변경되었습니다. 상품을 다시 불러온 뒤 수정해주세요.'), { status: 409 });
                    touched.add(String(inv._id));
                } else {
                    const prior = await Inventory.findOne({ variantId: existingVariant._id, size }).session(session);
                    if (prior) {
                        prior.isDeleted = false;
                        prior.stockQuantity = Number(inv.stockQuantity);
                        prior.sku = newSku;
                        prior.size = size;
                        await prior.save({ session });
                        touched.add(String(prior._id));
                    } else {
                        const created = await Inventory.create({
                            variantId: existingVariant._id,
                            sku: newSku,
                            size,
                            stockQuantity: Number(inv.stockQuantity),
                            isDeleted: false
                        }, { session });
                        touched.add(String(created._id));
                        knownSizes.add(size);
                    }
                }
            }

            const remaining = await Inventory.find({ variantId: existingVariant._id, isDeleted: false }).session(session);
            for (const row of remaining) {
                if (touched.has(String(row._id))) continue;
                row.isDeleted = true;
                await row.save({ session });
            }
        }

        await session.commitTransaction();
        res.status(200).json({ message: "상품 정보 및 재고가 성공적으로 수정되었습니다." });

    } catch (error) {
        await session.abortTransaction();
        if (error.name !== 'ValidationError') console.error('상품 수정 실패:', error.code || error.name);
        res.status(error.status || (error.name === 'ValidationError' ? 400 : 500)).json({ message: error.message || "수정 중 오류 발생" });
    } finally {
        await session.endSession();
    }
};

// [DELETE] 상품 삭제
exports.deleteProduct = async (req, res) => {
    const session = await maria.startSession();
    await session.startTransaction();

    try {
        const { id } = req.params;

        // 상품 상태 업데이트
        const deletedProduct = await Product.findByIdAndUpdate(
            id, 
            { 
                isDeleted: true,
                status: '중단'
            }, 
            { new: true, session }
        );

        if (!deletedProduct) {
            throw new Error("상품을 찾을 수 없습니다.");
        }

        // 트랜잭션 커밋
        await session.commitTransaction();

        res.status(200).json({ 
            success: true, 
            message: "상품이 성공적으로 삭제(판매 중단) 처리되었습니다." 
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "삭제 중 오류 발생", error: error.message });
    } finally {
        await session.endSession();
    }
};
