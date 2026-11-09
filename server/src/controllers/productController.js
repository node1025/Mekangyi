const maria = require('../config/maria');
const Product = require('../models/product/product');               // 상품 모델
const ProductVariant = require('../models/product/productvariant'); // 옵션 모델
const Inventory = require('../models/product/inventory');           // 재고 모델
const { literalSearch } = require('../utils/input');
const { enrichProductForResponse } = require('../utils/productPricing');
const { sortVariants } = require('../utils/variantOrder');

function parseOptionalEventDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) {
    throw Object.assign(new Error('이벤트 날짜 형식이 올바르지 않습니다.'), { status: 400 });
  }
  return d;
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

        // Product 생성
        const product = new Product({});
        applyProductPayloadToDoc(product, productData);
        if (productData.productCode) product.set('productCode', String(productData.productCode).trim());
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
            const vCode = (v.variantCode || `${productData.productCode}-${v.color}`)
                            .toUpperCase().replace(/\s/g, '');
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
        res.status(500).json({ message: "등록 중 오류 발생", error: error.message });
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
                .filter(v => v.productId.toString() === p._id.toString())
                .map(v => ({
                    ...v,
                    inventories: allInventories.filter(i => i.variantId.toString() === v._id.toString())
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
        const variants = await ProductVariant.find({ productId: product._id }).lean();
        const inventories = await Inventory.find({ variantId: { $in: variants.map(v => v._id) } }).lean();
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

        applyProductPayloadToDoc(product, productData);
        await product.save({ session }); 

        // Variants 및 Inventory 업데이트
        if (variants && Array.isArray(variants)) {
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                if (!v._id) continue;

                const existingVariant = await ProductVariant.findOne({ _id: v._id, productId: product._id }).session(session);
                if (existingVariant) {

                    // 이미지 업데이트 처리
                    if (req.files && req.files.length > 0) {
                        const newThumb = (req.files || []).find(f => f.fieldname === `variant_${i}_thumb`);
                        const newGallery = (req.files || []).filter(f => f.fieldname === `variant_${i}_gallery`).map(f => f.path);

                        if (newThumb) {
                            existingVariant.images.thumbnail = newThumb.path;
                        }
                        
                        if (newGallery.length > 0) {
                            existingVariant.images.gallery = newGallery;
                        }
                    }

                    // 일반 정보 업데이트
                    existingVariant.color = v.color || existingVariant.color;
                    existingVariant.variantCode = v.variantCode || existingVariant.variantCode;
                    await existingVariant.save({ session });

                    // Inventory (사이즈별 재고) 업데이트
                    if (v.inventories && Array.isArray(v.inventories)) {
                        for (const inv of v.inventories) {
                            if (!Number.isSafeInteger(Number(inv.stockQuantity)) || Number(inv.stockQuantity) < 0) {
                                throw Object.assign(new Error('재고는 0 이상의 정수여야 합니다.'), { status: 400 });
                            }
                            if (typeof inv.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(inv.expectedUpdatedAt))) {
                                throw Object.assign(new Error('최신 상품 정보를 다시 불러온 뒤 저장해주세요.'), { status: 409 });
                            }
                            const newSku = `${existingVariant.variantCode}-${inv.size}`.toUpperCase().replace(/\s/g, '');
                            
                            const updatedInventory = await Inventory.findOneAndUpdate(
                                { _id: inv._id, variantId: existingVariant._id, updatedAt: new Date(inv.expectedUpdatedAt) },
                                { 
                                    stockQuantity: Number(inv.stockQuantity),
                                    sku: newSku,
                                    size: inv.size
                                },
                                { session, runValidators: true }
                            );
                            if (!updatedInventory) throw Object.assign(new Error('재고가 변경되었습니다. 상품을 다시 불러온 뒤 수정해주세요.'), { status: 409 });
                        }
                    }
                }
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
