import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAllowNextNavigation, useBackGuard, type HeldNavigation } from '../../app/BackGuard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DiscardDialog } from '../../components/DiscardDialog';
import { Header, HeaderAction } from '../../components/Header';
import { Segmented } from '../../components/Segmented';
import { Switch } from '../../components/Switch';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { listCategories } from '../../db/repositories/categories';
import {
  createProduct,
  defaultCategoryIdForNewProduct,
  defaultTaxRateFor,
  deleteProduct,
  getProduct,
  updateProduct,
} from '../../db/repositories/products';
import {
  TAX_RATES,
  taxRateLabel,
  type Category,
  type Product,
  type TaxRate,
} from '../../domain/types';
import { useGoBack } from '../../hooks/useGoBack';
import { useProductImageUrl } from '../../hooks/useProductImageUrl';
import { errorMessage } from '../../lib/errorMessage';
import { digitsOnly } from '../../lib/format';
import { resizeImage, type ResizedImage } from '../../lib/image';
import { requestPersistentStorage } from '../../lib/storage';
import styles from './ProductEditScreen.module.css';

const NAME_MAX = 40;
const TAX_OPTIONS = TAX_RATES.map((rate) => ({ value: rate, label: taxRateLabel(rate) }));

interface Form {
  name: string;
  /** 入力欄の文字のまま持つ（空も許す） */
  price: string;
  taxRate: TaxRate;
  categoryId: string;
  tracksStock: boolean;
  isOnSale: boolean;
}

/** 画像をどうするか：そのまま / 新しい画像にする / 外す */
type ImageChange =
  { kind: 'keep' } | { kind: 'set'; image: ResizedImage; url: string } | { kind: 'remove' };

type Errors = Partial<Record<'name' | 'categoryId', string>>;

/** S-05b 商品編集（/products/new と /products/:id） */
export function ProductEditScreen() {
  const { id } = useParams();
  // 最初に読んだ内容でフォームを作る。カテゴリの一覧だけは、あとから変わっても反映する
  const initial = useLiveQuery(() => loadInitial(id), [id]);
  const categories = useLiveQuery(listCategories);

  if (initial === undefined || categories === undefined) {
    return <Header title={id ? '商品編集' : '商品を追加'} backTo="/products" />;
  }
  if (initial === null) {
    return (
      <>
        <Header title="商品編集" backTo="/products" />
        <p className={ui.empty}>商品が見つかりません。</p>
      </>
    );
  }
  return <ProductForm key={id ?? 'new'} initial={initial} categories={categories} />;
}

interface Initial {
  product: Product | null;
  form: Form;
}

async function loadInitial(id: string | undefined): Promise<Initial | null> {
  if (id) {
    const product = await getProduct(id);
    if (!product || product.deletedAt !== null) return null;
    return {
      product,
      form: {
        name: product.name,
        price: product.price === null ? '' : String(product.price),
        taxRate: product.taxRate,
        categoryId: product.categoryId,
        tracksStock: product.tracksStock,
        isOnSale: product.isOnSale,
      },
    };
  }
  const categoryId = await defaultCategoryIdForNewProduct();
  return {
    product: null,
    form: {
      name: '',
      price: '',
      taxRate: categoryId ? await defaultTaxRateFor(categoryId) : 8,
      categoryId: categoryId ?? '',
      tracksStock: true,
      isOnSale: true,
    },
  };
}

function ProductForm({ initial, categories }: { initial: Initial; categories: Category[] }) {
  const { product } = initial;
  const isNew = product === null;
  const [form, setForm] = useState<Form>(initial.form);
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
  const [errors, setErrors] = useState<Errors>({});
  const [taxTouched, setTaxTouched] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState<HeldNavigation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  const goBack = useGoBack('/products');
  const allowNext = useAllowNextNavigation();
  const savedImageUrl = useProductImageUrl(product ?? undefined);

  const dirty =
    image.kind !== 'keep' ||
    (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== initial.form[k]);

  // 入力途中で戻ろうとしたら確かめる（02-画面設計 S-05b）
  useBackGuard(dirty && !saving, setHeld, { blockAll: true });

  // 選んだ画像のプレビュー用 URL は、差し替えたときと画面を閉じたときに解放する
  useEffect(() => {
    const url = image.kind === 'set' ? image.url : null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image]);

  const previewUrl =
    image.kind === 'set' ? image.url : image.kind === 'remove' ? null : savedImageUrl;

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const changeCategory = (categoryId: string) => {
    update('categoryId', categoryId);
    // 新しい商品で税率を自分で選んでいなければ、そのカテゴリの直前の商品に合わせる
    if (isNew && !taxTouched && categoryId) {
      void defaultTaxRateFor(categoryId).then((rate) => setForm((f) => ({ ...f, taxRate: rate })));
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setLoadingImage(true);
    try {
      const resized = await resizeImage(file);
      setImage({ kind: 'set', image: resized, url: URL.createObjectURL(resized.blob) });
    } catch {
      showToast('画像を読み込めませんでした');
    } finally {
      setLoadingImage(false);
    }
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (form.name.trim() === '') next.name = '商品名を入力してください';
    if (!categories.some((c) => c.id === form.categoryId))
      next.categoryId = 'カテゴリを選んでください';
    return next;
  };

  const save = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const input = { ...form, price: form.price === '' ? null : Number(form.price) };
    const imageData =
      image.kind === 'set'
        ? {
            data: await image.image.blob.arrayBuffer(),
            type: image.image.blob.type,
            width: image.image.width,
            height: image.image.height,
          }
        : image.kind === 'remove'
          ? null
          : undefined;
    setSaving(true);
    try {
      if (isNew) {
        await createProduct(input, imageData ?? undefined);
        void requestPersistentStorage();
      } else {
        await updateProduct(product.id, input, imageData);
      }
      showToast('保存しました');
      allowNext();
      goBack();
    } catch (e) {
      setSaving(false);
      showToast(errorMessage(e));
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!product) return;
    try {
      await deleteProduct(product.id);
      showToast('削除しました');
      allowNext();
      goBack();
    } catch (e) {
      showToast(errorMessage(e, '削除できませんでした'));
    }
  };

  if (categories.length === 0) {
    return (
      <>
        <Header title="商品を追加" backTo="/products" />
        <div className={ui.empty}>
          <p>商品を登録する前に、カテゴリを追加してください。</p>
          <Link to="/categories" className={ui.button}>
            カテゴリへ
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={isNew ? '商品を追加' : '商品編集'}
        backTo="/products"
        right={
          <HeaderAction onClick={() => void save()} disabled={saving || loadingImage}>
            保存
          </HeaderAction>
        }
      />
      <form className={ui.body} onSubmit={(e) => e.preventDefault()} noValidate>
        <div className={styles.imageRow}>
          {previewUrl ? (
            <img className={styles.preview} src={previewUrl} alt="商品画像" />
          ) : (
            <div className={styles.preview} aria-label="画像なし" role="img">
              {loadingImage ? '読み込み中…' : '画像なし'}
            </div>
          )}
          <div className={styles.imageButtons}>
            <button
              type="button"
              className={ui.button}
              onClick={() => cameraInput.current?.click()}
              disabled={loadingImage}
            >
              撮影
            </button>
            <button
              type="button"
              className={ui.button}
              onClick={() => libraryInput.current?.click()}
              disabled={loadingImage}
            >
              選択
            </button>
            {previewUrl && (
              <button
                type="button"
                className={`${ui.button} ${ui.danger}`}
                onClick={() => setImage({ kind: 'remove' })}
              >
                画像を外す
              </button>
            )}
          </div>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label="画像を撮影"
            onChange={(e) => {
              void pickImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={libraryInput}
            type="file"
            accept="image/*"
            hidden
            aria-label="画像を選択"
            onChange={(e) => {
              void pickImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label} htmlFor="product-name">
            商品名
          </label>
          <input
            id="product-name"
            className={ui.input}
            value={form.name}
            maxLength={NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'product-name-error' : undefined}
            onChange={(e) => update('name', e.target.value)}
          />
          {errors.name && (
            <p id="product-name-error" className={ui.error}>
              {errors.name}
            </p>
          )}
        </div>

        <div className={ui.field}>
          <label className={ui.label} htmlFor="product-price">
            価格（税込）
          </label>
          <div className={styles.priceRow}>
            <input
              id="product-price"
              className={ui.input}
              value={form.price}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-describedby="product-price-hint"
              onChange={(e) => update('price', digitsOnly(e.target.value).replace(/^0+(?=\d)/, ''))}
            />
            <span>円</span>
          </div>
          <p id="product-price-hint" className={ui.hint}>
            空にすると、会計のときに金額を入力します
          </p>
        </div>

        <div className={ui.field}>
          <span className={ui.label}>税率</span>
          <Segmented
            label="税率"
            options={TAX_OPTIONS}
            value={form.taxRate}
            onChange={(rate) => {
              setTaxTouched(true);
              update('taxRate', rate);
            }}
          />
        </div>

        <div className={ui.field}>
          <label className={ui.label} htmlFor="product-category">
            カテゴリ
          </label>
          <select
            id="product-category"
            className={ui.select}
            value={form.categoryId}
            aria-invalid={!!errors.categoryId}
            onChange={(e) => changeCategory(e.target.value)}
          >
            {!categories.some((c) => c.id === form.categoryId) && (
              <option value="">選んでください</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <p className={ui.error}>{errors.categoryId}</p>}
        </div>

        <div className={ui.field}>
          <Switch
            label="在庫を管理する"
            description="イベントごとに持ち込み数を決めて、残りを数えます"
            checked={form.tracksStock}
            onChange={(v) => update('tracksStock', v)}
          />
          <Switch
            label="販売中"
            description="OFF にすると会計画面に出しません"
            checked={form.isOnSale}
            onChange={(v) => update('isOnSale', v)}
          />
        </div>

        {!isNew && (
          <div className={styles.deleteArea}>
            <button
              type="button"
              className={`${ui.button} ${ui.danger} ${ui.block}`}
              onClick={() => setConfirmDelete(true)}
            >
              この商品を削除する
            </button>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="商品を削除しますか？"
        message="商品一覧から消えます。過去の取引の記録は残ります。"
        confirmLabel="削除する"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <DiscardDialog held={held} onDone={() => setHeld(null)} />
    </>
  );
}
