import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { CategoryDot } from '../../components/CategoryDot';
import { Header, HeaderAction } from '../../components/Header';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { listCategories } from '../../db/repositories/categories';
import { listProducts, moveProduct } from '../../db/repositories/products';
import { taxRateLabel, type Product } from '../../domain/types';
import { useProductImageUrl } from '../../hooks/useProductImageUrl';
import { errorMessage } from '../../lib/errorMessage';
import { formatYen } from '../../lib/format';
import { groupByCategory } from './grouping';
import styles from './ProductsScreen.module.css';

/** S-05a 商品一覧 */
export function ProductsScreen() {
  const data = useLiveQuery(async () => ({
    categories: await listCategories(),
    products: await listProducts(),
  }));
  const [sorting, setSorting] = useState(false);

  const groups = data ? groupByCategory(data.categories, data.products) : [];
  const hasCategory = (data?.categories.length ?? 0) > 0;
  const hasProduct = (data?.products.length ?? 0) > 0;

  const move = (id: string, direction: -1 | 1) => {
    moveProduct(id, direction).catch((e: unknown) => showToast(errorMessage(e)));
  };

  return (
    <>
      <Header
        title="商品"
        backTo="/more"
        right={
          hasProduct && (
            <HeaderAction onClick={() => setSorting(!sorting)}>
              {sorting ? '完了' : '並べ替え'}
            </HeaderAction>
          )
        }
      />
      <div className={ui.body}>
        {data && !hasCategory && (
          <div className={ui.empty}>
            <p>商品を登録する前に、カテゴリを追加してください。</p>
            <Link to="/categories" className={ui.button}>
              カテゴリへ
            </Link>
          </div>
        )}
        {data && hasCategory && !hasProduct && <p className={ui.empty}>商品がまだありません。</p>}
        {hasProduct &&
          groups
            .filter((g) => g.products.length > 0)
            .map(({ category, products }) => (
              <section key={category.id} className={styles.group}>
                <h2 className={styles.groupTitle}>
                  <CategoryDot color={category.color} />
                  {category.name}
                </h2>
                <ul className={ui.list}>
                  {products.map((p, i) => (
                    <li key={p.id} className={ui.rowWithActions}>
                      {sorting ? (
                        <>
                          <div className={ui.row}>
                            <ProductSummary product={p} />
                          </div>
                          <span className={ui.moveButtons}>
                            <button
                              type="button"
                              className={ui.button}
                              onClick={() => move(p.id, -1)}
                              disabled={i === 0}
                              aria-label={`${p.name}を上へ`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={ui.button}
                              onClick={() => move(p.id, 1)}
                              disabled={i === products.length - 1}
                              aria-label={`${p.name}を下へ`}
                            >
                              ↓
                            </button>
                          </span>
                        </>
                      ) : (
                        <Link to={`/products/${p.id}`} className={ui.row}>
                          <ProductSummary product={p} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
      </div>
      {hasCategory && !sorting && (
        <div className={ui.footer}>
          <Link to="/products/new" className={`${ui.button} ${ui.primary} ${ui.large}`}>
            ＋ 商品を追加
          </Link>
        </div>
      )}
    </>
  );
}

/** 1 行の中身：画像、商品名、価格、税率。販売中でなければ薄くして「販売休止」 */
function ProductSummary({ product }: { product: Product }) {
  const imageUrl = useProductImageUrl(product);
  return (
    <>
      <span className={product.isOnSale ? undefined : ui.dimmed}>
        {imageUrl ? (
          <img className={ui.thumb} src={imageUrl} alt="" />
        ) : (
          <span className={ui.thumb} style={{ display: 'block' }} />
        )}
      </span>
      <span className={`${ui.rowMain} ${product.isOnSale ? '' : ui.dimmed}`}>
        <span className={ui.rowTitle}>{product.name}</span>
        <span className={ui.rowSub}>
          <span className={styles.price}>{formatYen(product.price)}</span>・
          {taxRateLabel(product.taxRate)}
          {product.tracksStock ? '・在庫を管理' : ''}
        </span>
      </span>
      {!product.isOnSale && <span className={ui.badge}>販売休止</span>}
    </>
  );
}
