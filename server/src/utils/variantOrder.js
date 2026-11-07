const colors = {
  bukangi_tshirt: ['화이트', '블랙'],
  bukangi_plush_doll: ['블루', '핑크'],
  bukangi_doll_keyring: ['블루', '핑크']
};
function sortVariants(code, variants) {
  const order = colors[code] || [];
  const rank = value => { const index = order.indexOf(value); return index < 0 ? order.length : index; };
  return [...variants].sort((a, b) => rank(a.color) - rank(b.color));
}
module.exports = { sortVariants };
