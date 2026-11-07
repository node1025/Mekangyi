// Only copy explicitly allowed top-level fields; never pass request bodies to $set.
exports.pick = (source, fields) => Object.fromEntries(
    fields.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]])
);

exports.isQuantity = value => Number.isSafeInteger(value) && value > 0;

exports.literalSearch = value => {
    if (typeof value !== 'string' || value.length > 100) return null;
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
