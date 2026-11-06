import { Header } from '../../components/Header';
import { Placeholder } from '../../components/Placeholder';

export function ProductsScreen() {
  return (
    <>
      <Header title="商品" backTo="/more" />
      <Placeholder screen="S-05a 商品一覧" milestone="M2" />
    </>
  );
}
