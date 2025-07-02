import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, getDocs, writeBatch, query, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { ShoppingCart, Trash2, Package, ArrowLeft, PlusCircle, Edit, Banknote, Upload, X, CheckCircle, Truck, Star, Eye, EyeOff, Mail, Tag } from 'lucide-react';
import * as Tone from 'tone';

// --- Configuración de Firebase ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-ecommerce-app-stable';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Configuración de Moneda Fija ---
const CURRENCY_INFO = { code: 'ARS', symbol: '$' };

// --- Datos de Ejemplo ---
const MOCK_PRODUCTS = [
    {
        name: 'Auriculares THUNDER-BASS',
        description: 'Experimenta un sonido inmersivo con nuestros auriculares estrella. Cancelación de ruido activa, 30 horas de batería y un diseño ultraligero. Perfectos para música, podcasts y llamadas.',
        price: 89999.99,
        category: 'Audio',
        imageUrl: 'https://placehold.co/600x400/4f46e5/ffffff?text=THUNDER-BASS',
        isActive: true,
    }
];

const MOCK_REVIEWS = [
    { name: 'Carlos M.', rating: 5, comment: '¡Excelente producto y entrega rapidísima! Totalmente recomendado.' },
    { name: 'Ana P.', rating: 5, comment: 'La calidad superó mis expectativas. Muy buena atención al cliente.' },
    { name: 'Jorge L.', rating: 4, comment: 'Buen producto, cumple con lo especificado.' },
];

// --- Función de Utilidad para Imágenes ---
const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); 
        };
        img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
});


// --- Componentes de la UI (Definidos antes de App) ---

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ThunderIcon = () => (
    <div className="w-9 h-9 mr-3 flex items-center justify-center bg-indigo-600 dark:bg-indigo-500 rounded-full shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M11.917 1.312a.5.5 0 00-.834-.448L3.417 9.5H9.5a.5.5 0 01.474.658L7.058 18.84c-.1.34.218.66.562.66h.016a.5.5 0 00.448-.342L16.583 10.5H10.5a.5.5 0 01-.474-.658L11.917 1.312z" /></svg>
    </div>
);

const ThunderEffect = ({ active, position }) => {
    if (!active) return null;
    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            <div className="absolute inset-0 bg-white opacity-50 animate-flash"></div>
            <svg className="absolute w-24 h-24 text-yellow-300 animate-lightning" style={{ left: `${position.x - 48}px`, top: `${position.y - 48}px` }}>
                <path d="M 50,0 L 20,50 L 40,50 L 10,100 L 80,40 L 60,40 Z" stroke="white" strokeWidth="2" fill="currentColor" />
            </svg>
        </div>
    );
};

const Notification = ({ message, type, onDismiss }) => {
  useEffect(() => { 
      if(message) {
        const timer = setTimeout(onDismiss, 3000); 
        return () => clearTimeout(timer);
      }
  }, [message, onDismiss]);

  if (!message) return null;
  const baseClasses = 'fixed top-20 right-5 p-4 rounded-lg shadow-lg text-white z-[130] transition-transform transform';
  const typeClasses = { success: 'bg-green-500', error: 'bg-red-500' };
  
  return <div className={`${baseClasses} ${typeClasses[type]}`}>{message}</div>;
};

const Header = ({ onNavigate, cartItemCount }) => (
  <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center"><button onClick={() => onNavigate('home')} className="flex-shrink-0 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center"><ThunderIcon />THUNDER</button></div>
        <div className="hidden md:block"><div className="ml-10 flex items-baseline space-x-4"><button onClick={() => onNavigate('home')} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Inicio</button><button onClick={() => onNavigate('products')} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Productos</button><button onClick={() => onNavigate('my-orders')} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Mis Pedidos</button></div></div>
        <div className="flex items-center">
          <button onClick={() => onNavigate('cart')} className="relative p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"><ShoppingCart className="h-6 w-6" />{cartItemCount > 0 && <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{cartItemCount}</span>}</button>
        </div>
      </div>
    </div>
  </header>
);

const CategoryNav = ({ categories, onSelectCategory, selectedCategory }) => (
    <nav className="bg-gray-100 dark:bg-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-4 h-12 overflow-x-auto">
                <button onClick={() => onSelectCategory(null)} className={`px-3 py-2 rounded-md text-sm font-medium ${!selectedCategory ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Todos</button>
                {categories.map(category => (
                    <button key={category} onClick={() => onSelectCategory(category)} className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${selectedCategory === category ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                        {category}
                    </button>
                ))}
            </div>
        </div>
    </nav>
);

const formatPrice = (price) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: CURRENCY_INFO.code }).format(price || 0);

const ImageViewerModal = ({ imageUrl, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[110] p-4" onClick={onClose}>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img src={imageUrl} alt="Comprobante o Guía" className="max-w-full max-h-[90vh]"/>
            <button onClick={onClose} className="absolute -top-4 -right-4 bg-white rounded-full p-1 text-gray-800"><X/></button>
        </div>
    </div>
);

const ProductCard = ({ product, onAddToCart, onNavigateToProduct, triggerThunderEffect }) => {
    const [quantity, setQuantity] = useState(1);
    const handleAddToCartClick = (e) => {
        triggerThunderEffect(e);
        onAddToCart(product, quantity);
    };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
            <button onClick={() => onNavigateToProduct(product)} className="w-full text-left">
                <img className="w-full h-56 object-cover" src={product.imageUrl} alt={product.name} onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x400/cccccc/ffffff?text=Imagen+no+disponible'; }}/>
            </button>
            <div className="p-6 flex flex-col flex-grow">
                <button onClick={() => onNavigateToProduct(product)} className="w-full text-left">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-indigo-600">{product.name}</h3>
                </button>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm flex-grow">{product.description.substring(0, 90)}...</p>
                <div className="mt-auto">
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatPrice(product.price)}</span>
                    <div className="flex items-center justify-between mt-4">
                        <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 text-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600" />
                        <button onClick={handleAddToCartClick} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full transition-colors duration-300 flex items-center"><ShoppingCart className="w-5 h-5 mr-2"/>Añadir</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Testimonials = () => (
    <div className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">Lo que dicen nuestros clientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {MOCK_REVIEWS.map((review, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <div className="flex items-center mb-4">
                            <div className="flex text-yellow-400">{[...Array(review.rating)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current"/>)}</div>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">"{review.comment}"</p>
                        <p className="font-semibold text-gray-800 dark:text-white">{review.name}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const HomePage = ({ products, onAddToCart, onNavigate, onNavigateToProduct, triggerThunderEffect }) => (
    <div>
        <div className="bg-indigo-600 dark:bg-indigo-900 text-white"><div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"><h1 className="text-4xl md:text-6xl font-extrabold mb-4">Pide. Parpadea. Recibe. THUNDER.</h1><p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">Elige lo que quieres. Lo tendrás antes de que termines de leer esto.</p><button onClick={() => onNavigate('products')} className="bg-white text-indigo-600 font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-200 transition-colors duration-300">Ver Productos</button></div></div>
        <div className="py-16"><div className="container mx-auto px-4 sm:px-6 lg:px-8"><h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">Productos Destacados</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{products.slice(0, 3).map(product => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onNavigateToProduct={onNavigateToProduct} triggerThunderEffect={triggerThunderEffect} />)}</div></div></div>
        <Testimonials />
    </div>
);

const ProductListPage = ({ products, onAddToCart, onNavigateToProduct, selectedCategory, triggerThunderEffect }) => {
    const filteredProducts = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-10 text-center">{selectedCategory || 'Todos los Productos'}</h1>
            {filteredProducts.length === 0 ? <p className="text-center text-gray-500 dark:text-gray-400">No hay productos en esta categoría.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">{filteredProducts.map(product => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} onNavigateToProduct={onNavigateToProduct} triggerThunderEffect={triggerThunderEffect} />)}</div>}
        </div>
    );
};

const ProductDetailPage = ({ product, onAddToCart, onNavigate, triggerThunderEffect }) => {
    const [quantity, setQuantity] = useState(1);
    const [isImageVisible, setIsImageVisible] = useState(false);
    if (!product) return <div className="text-center p-20">Producto no encontrado. <button onClick={() => onNavigate('products')} className="text-indigo-500 underline">Volver a productos</button></div>;

    const handleAddToCartClick = (e) => {
        triggerThunderEffect(e);
        onAddToCart(product, quantity);
    };

    return (
        <>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <img src={product.imageUrl} alt={product.name} onClick={() => setIsImageVisible(true)} className="w-full rounded-lg shadow-lg cursor-pointer"/>
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{product.name}</h1>
                        <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-6">{formatPrice(product.price)}</p>
                        <p className="text-gray-700 dark:text-gray-300 mb-8">{product.description}</p>
                        <div className="flex items-center space-x-4">
                            <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 text-center p-3 text-lg bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600" />
                            <button onClick={handleAddToCartClick} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center text-lg"><ShoppingCart className="w-6 h-6 mr-3"/>Añadir al Carrito</button>
                        </div>
                    </div>
                </div>
            </div>
            {isImageVisible && <ImageViewerModal imageUrl={product.imageUrl} onClose={() => setIsImageVisible(false)} />}
        </>
    );
};

const CartPage = ({ cart, onUpdateQuantity, onRemoveItem, onNavigate, triggerThunderEffect }) => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal > 0 ? 10000.00 : 0;
    const total = subtotal + shipping;
    
    const handleCheckoutClick = (e) => {
        triggerThunderEffect(e);
        onNavigate('checkout');
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-10">Tu Carrito</h1>
            {cart.length === 0 ? <div className="text-center bg-white dark:bg-gray-800 p-10 rounded-lg shadow-md"><ShoppingCart className="mx-auto h-16 w-16 text-gray-400" /><p className="mt-4 text-xl text-gray-500 dark:text-gray-400">Tu carrito está vacío.</p><button onClick={() => onNavigate('products')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-300">Explorar productos</button></div> : <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-2 space-y-4">{cart.map(item => <div key={item.id} className="flex items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md"><img src={item.imageUrl} alt={item.name} className="w-24 h-24 object-cover rounded-md mr-4" /><div className="flex-grow"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3><p className="text-indigo-600 dark:text-indigo-400 font-bold">{formatPrice(item.price)}</p></div><div className="flex items-center"><input type="number" value={item.quantity} onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10))} min="1" className="w-16 text-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600" /><button onClick={() => onRemoveItem(item.id)} className="ml-4 text-red-500 hover:text-red-700"><Trash2 className="w-6 h-6" /></button></div></div>)}</div><div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit"><h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Resumen del Pedido</h2><div className="space-y-2"><div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div className="flex justify-between"><span>Envío</span><span>{formatPrice(shipping)}</span></div><hr className="my-2 border-gray-200 dark:border-gray-700"/><div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatPrice(total)}</span></div></div><button onClick={handleCheckoutClick} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors duration-300">Proceder al Pago</button></div></div>}
        </div>
    );
};

const CheckoutPage = ({ onPlaceOrder, onNavigate, cart, paymentInfo, triggerThunderEffect }) => {
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptDataUrl, setReceiptDataUrl] = useState('');
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal > 0 ? 10000.00 : 0;
    const total = subtotal + shipping;

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const resizedDataUrl = await resizeImage(file);
                setReceiptFile(file);
                setReceiptDataUrl(resizedDataUrl);
            } catch (error) {
                console.error("Error resizing image:", error);
                alert("Hubo un error al procesar la imagen.");
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!receiptFile) {
            alert('Por favor, adjunta el comprobante de pago.');
            return;
        }
        triggerThunderEffect(e);
        const formData = new FormData(e.target);
        const orderDetails = {
            shippingAddress: { 
                name: formData.get('name'), 
                dni: formData.get('dni'),
                localidad: formData.get('localidad'),
                provincia: formData.get('provincia'),
                telefono: formData.get('telefono'),
                correo: formData.get('correo')
            },
            total,
            paymentMethod: 'transfer',
            receiptFileName: receiptFile ? receiptFile.name : null,
            receiptDataUrl: receiptDataUrl
        };
        onPlaceOrder(orderDetails);
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <button onClick={() => onNavigate('cart')} className="flex items-center text-indigo-600 dark:text-indigo-400 hover:underline mb-6"><ArrowLeft className="w-5 h-5 mr-2" />Volver al carrito</button>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-10">Checkout</h1>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold mb-6">Información de Envío</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <input name="name" type="text" placeholder="Nombre Completo" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                            <input name="dni" type="text" placeholder="DNI" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                            <input name="localidad" type="text" placeholder="Localidad" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                            <input name="provincia" type="text" placeholder="Provincia" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                            <input name="telefono" type="tel" placeholder="Teléfono" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                            <input name="correo" type="email" placeholder="Correo Electrónico" required className="p-3 rounded-md bg-gray-100 dark:bg-gray-700 border-transparent focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold mb-6">Método de Pago</h2>
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center">
                                <Banknote className="w-6 h-6 mr-3"/>
                                <span className="font-medium">Transferencia Bancaria</span>
                            </div>
                        </div>
                        <div className="mt-6 p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg">
                            <h3 className="font-bold text-lg mb-2">Datos para la Transferencia</h3>
                            {paymentInfo ? <div className="space-y-1 text-sm"><p><strong>Alias:</strong> {paymentInfo.alias}</p><p><strong>CBU/CVU:</strong> {paymentInfo.cbu}</p><p><strong>Titular:</strong> {paymentInfo.holderName}</p><p><strong>CUIT:</strong> {paymentInfo.cuit}</p></div> : <p>Cargando datos de pago...</p>}
                            <p className="mt-4 text-sm font-semibold">Una vez realizado el pago, por favor adjunta el comprobante.</p>
                            <div className="mt-4"><label htmlFor="receipt" className="w-full flex items-center justify-center px-4 py-3 bg-white border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100"><Upload className="w-5 h-5 mr-2"/><span>{receiptFile ? receiptFile.name : 'Adjuntar Comprobante'}</span></label><input id="receipt" type="file" onChange={handleFileChange} className="hidden"/></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-fit">
                    <h2 className="text-2xl font-bold mb-4">Tu Pedido</h2>
                    {cart.map(item => <div key={item.id} className="flex justify-between items-center text-sm mb-2"><span className="text-gray-600 dark:text-gray-400">{item.name} x {item.quantity}</span><span className="font-medium">{formatPrice(item.price * item.quantity)}</span></div>)}
                    <hr className="my-3 border-gray-200 dark:border-gray-700"/>
                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                    <div className="flex justify-between text-sm mb-3"><span>Envío</span><span>{formatPrice(shipping)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatPrice(total)}</span></div>
                    <button type="submit" className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors duration-300">Realizar Pedido</button>
                </div>
            </form>
        </div>
    );
};

const OrderConfirmationPage = ({ order, onNavigate }) => (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <div className="bg-white dark:bg-gray-800 p-10 rounded-lg shadow-2xl max-w-2xl mx-auto">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6"><Package className="h-10 w-10 text-green-600"/></div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">¡Gracias por tu compra!</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Hemos recibido tu pedido. Quedará pendiente hasta que verifiquemos el comprobante de pago.</p>
            <div className="mt-8 text-left bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                <p className="mb-2"><strong>Número de Pedido:</strong> <span className="font-mono text-indigo-600 dark:text-indigo-400">{order.orderId}</span></p>
                <p><strong>Total Pagado:</strong> <span className="font-bold text-xl">{formatPrice(order.total)}</span></p>
            </div>
            <button onClick={() => onNavigate('home')} className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition-colors duration-300">Seguir Comprando</button>
        </div>
    </div>
);

const OrderStatusBadge = ({ status }) => {
    const badgeStyles = {
        'Pendiente de Confirmación': 'bg-yellow-100 text-yellow-800', 'En Proceso': 'bg-blue-100 text-blue-800',
        'Enviado': 'bg-green-100 text-green-800'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeStyles[status] || 'bg-gray-200'}`}>{status}</span>;
};

const MyOrdersPage = ({ orders, onNavigate }) => {
    const [viewingGuideUrl, setViewingGuideUrl] = useState(null);
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-10">Mis Pedidos</h1>
            <div className="space-y-6">
                {orders.length > 0 ? orders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg">Pedido #{order.orderId.split('-')[1]}</p>
                                <p className="text-sm text-gray-500">Realizado el: {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <OrderStatusBadge status={order.status} />
                        </div>
                        <hr className="my-4"/>
                        <div>{order.items.map(item => <p key={item.id} className="text-sm">{item.name} x {item.quantity}</p>)}</div>
                        {order.status === 'Enviado' && (
                            <div className="mt-4 p-4 bg-green-50 dark:bg-gray-700 rounded-lg">
                                <h4 className="font-semibold">Información de Seguimiento</h4>
                                <p className="text-sm"><strong>Número:</strong> {order.trackingNumber}</p>
                                {order.trackingGuideFileName && <p className="text-sm"><strong>Guía:</strong> <button onClick={() => setViewingGuideUrl(order.trackingGuideDataUrl)} className="text-indigo-600 underline">{order.trackingGuideFileName}</button></p>}
                            </div>
                        )}
                    </div>
                )) : <p>No has realizado ningún pedido todavía.</p>}
            </div>
            {viewingGuideUrl && <ImageViewerModal imageUrl={viewingGuideUrl} onClose={() => setViewingGuideUrl(null)} />}
        </div>
    );
};

// --- Componentes del Panel de Administrador ---

const AdminProductForm = ({ product, onSave, onCancel }) => {
    const [formData, setFormData] = useState(product || { name: '', description: '', price: '', category: '', imageUrl: '', isActive: true });
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, price: parseFloat(formData.price) }); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl w-full max-w-lg"><h2 className="text-2xl font-bold mb-6">{product ? 'Editar' : 'Añadir'} Producto</h2><form onSubmit={handleSubmit} className="space-y-4"><input name="name" value={formData.name} onChange={handleChange} placeholder="Nombre del Producto" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/><textarea name="description" value={formData.description} onChange={handleChange} placeholder="Descripción" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700 h-24"/><input name="price" type="number" value={formData.price} onChange={handleChange} placeholder="Precio (ARS)" required min="0" step="0.01" className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/><input name="category" value={formData.category} onChange={handleChange} placeholder="Categoría" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/><input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="URL de la Imagen" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/><div className="flex items-center"><input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" /><label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Producto Activo</label></div><div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onCancel} className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300">Cancelar</button><button type="submit" className="px-6 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Guardar</button></div></form></div></div>
    );
};

const AdminPaymentSettings = ({ paymentInfo, onSave }) => {
    const [info, setInfo] = useState(paymentInfo || { alias: '', cbu: '', holderName: '', cuit: '' });
    useEffect(() => { setInfo(paymentInfo || { alias: '', cbu: '', holderName: '', cuit: '' }); }, [paymentInfo]);
    const handleSubmit = (e) => { e.preventDefault(); onSave(info); };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mt-10">
            <h2 className="text-2xl font-bold mb-6">Configuración de Pago por Transferencia</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input value={info.alias} onChange={(e) => setInfo({...info, alias: e.target.value})} placeholder="Alias" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/>
                <input value={info.cbu} onChange={(e) => setInfo({...info, cbu: e.target.value})} placeholder="CBU/CVU" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/>
                <input value={info.holderName} onChange={(e) => setInfo({...info, holderName: e.target.value})} placeholder="Nombre del Titular" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/>
                <input value={info.cuit} onChange={(e) => setInfo({...info, cuit: e.target.value})} placeholder="CUIT/CUIL del Titular" required className="w-full p-3 rounded-md bg-gray-100 dark:bg-gray-700"/>
                <div className="flex justify-end pt-4"><button type="submit" className="px-6 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Guardar Datos de Pago</button></div>
            </form>
        </div>
    );
};

const AdminOrderDetailsModal = ({ order, onClose, onUpdateStatus }) => {
    const [isEditingShipping, setIsEditingShipping] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [trackingFile, setTrackingFile] = useState(null);
    const [trackingFileDataUrl, setTrackingFileDataUrl] = useState('');
    const [isReceiptVisible, setIsReceiptVisible] = useState(false);

    useEffect(() => {
        setIsEditingShipping(false);
        setTrackingNumber(order?.trackingNumber || '');
        setTrackingFile(null);
        setTrackingFileDataUrl('');
    }, [order]);

    const handleTrackingFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const resizedDataUrl = await resizeImage(file);
                setTrackingFile(file);
                setTrackingFileDataUrl(resizedDataUrl);
            } catch (error) {
                console.error("Error resizing image:", error);
            }
        }
    };

    const handleConfirmShipment = () => {
        if (!trackingNumber) {
            alert('Por favor, ingresa un número de seguimiento.');
            return;
        }
        const trackingInfo = {
            number: trackingNumber,
            guideFileName: trackingFile ? trackingFile.name : order.trackingGuideFileName,
            guideDataUrl: trackingFileDataUrl ? trackingFileDataUrl : order.trackingGuideDataUrl,
        };
        onUpdateStatus(order, 'Enviado', trackingInfo);
        setIsEditingShipping(false);
    };

    if (!order) return null;
    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl w-full max-w-3xl relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X/></button>
                    <h2 className="text-2xl font-bold mb-6">Detalles del Pedido #{order.orderId.split('-')[1]}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold mb-2">Cliente y Envío</h3>
                            <p><strong>Nombre:</strong> {order.shippingAddress.name}</p>
                            <p><strong>DNI:</strong> {order.shippingAddress.dni}</p>
                            <p><strong>Localidad:</strong> {order.shippingAddress.localidad}</p>
                            <p><strong>Provincia:</strong> {order.shippingAddress.provincia}</p>
                            <p><strong>Teléfono:</strong> {order.shippingAddress.telefono}</p>
                            <p><strong>Correo:</strong> {order.shippingAddress.correo}</p>
                            <h3 className="font-semibold mt-4 mb-2">Productos</h3>
                            <ul>{order.items.map(item => <li key={item.id}>{item.name} x {item.quantity} - {formatPrice(item.price * item.quantity)}</li>)}</ul>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Información del Pago</h3>
                            <p><strong>Total:</strong> {formatPrice(order.total)}</p><p><strong>Método:</strong> {order.paymentMethod}</p><p><strong>Estado:</strong> <OrderStatusBadge status={order.status} /></p>
                            {order.receiptFileName && <p className="mt-2"><strong>Comprobante:</strong> <button onClick={() => setIsReceiptVisible(true)} className="text-indigo-600 underline cursor-pointer">{order.receiptFileName}</button></p>}
                            <div className="mt-6 space-y-2">
                                {order.status === 'Pendiente de Confirmación' && <button onClick={() => onUpdateStatus(order, 'En Proceso')} className="w-full flex items-center justify-center py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600"><CheckCircle className="mr-2"/>Confirmar Pago</button>}
                                {order.status === 'En Proceso' && !isEditingShipping && <button onClick={() => setIsEditingShipping(true)} className="w-full flex items-center justify-center py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"><Truck className="mr-2"/>Preparar Envío</button>}
                                {order.status === 'Enviado' && !isEditingShipping && <button onClick={() => setIsEditingShipping(true)} className="w-full flex items-center justify-center py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600"><Edit className="mr-2"/>Editar Envío</button>}
                                {isEditingShipping && (
                                    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-4">
                                        <h4 className="font-semibold text-center">{(order.status === 'Enviado') ? 'Editar Envío' : 'Preparar Envío'}</h4>
                                        <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Número de Seguimiento" className="w-full p-2 rounded-md"/>
                                        <label htmlFor="trackingFile" className="w-full flex items-center justify-center px-4 py-2 bg-white border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100"><Upload className="w-5 h-5 mr-2"/><span>{trackingFile ? trackingFile.name : 'Adjuntar Guía'}</span></label><input id="trackingFile" type="file" onChange={handleTrackingFileChange} className="hidden"/>
                                        <button onClick={handleConfirmShipment} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Confirmar Envío</button>
                                    </div>
                                )}
                                {order.status === 'Enviado' && !isEditingShipping && <p className="text-center text-green-600 font-semibold flex items-center justify-center mt-2"><CheckCircle className="mr-2"/>Pedido completado.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isReceiptVisible && <ImageViewerModal imageUrl={order.receiptDataUrl} onClose={() => setIsReceiptVisible(false)} />}
        </>
    );
};

const AdminNotificationsPage = ({ notifications }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <h2 className="text-2xl font-bold p-6">Notificaciones por Correo (Simulador)</h2>
        <div className="space-y-4 p-6">
            {notifications.length > 0 ? notifications.slice().sort((a, b) => (b.sentAt?.seconds || 0) - (a.sentAt?.seconds || 0)).map(notif => (
                <div key={notif.id} className="p-4 border rounded-lg dark:border-gray-700">
                    <p className="font-semibold">Para: <span className="font-normal">{notif.to}</span></p>
                    <p className="font-semibold">Asunto: <span className="font-normal">{notif.subject}</span></p>
                    <hr className="my-2 dark:border-gray-600"/>
                    <p className="text-sm whitespace-pre-wrap">{notif.body}</p>
                </div>
            )) : <p>No hay notificaciones.</p>}
        </div>
    </div>
);

const AdminPage = ({ products, onSaveProduct, onDeleteProduct, paymentInfo, onSavePaymentInfo, orders, onUpdateStatus, onDeleteOrder, emailNotifications, onToggleProductStatus }) => {
    const [view, setView] = useState('products');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [deletingOrder, setDeletingOrder] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const handleAddNew = () => { setEditingProduct(null); setShowForm(true); };
    const handleEdit = (product) => { setEditingProduct(product); setShowForm(true); };
    const handleSave = (product) => { onSaveProduct(product); setShowForm(false); setEditingProduct(null); };
    const handleDeleteClick = (productId) => setDeletingId(productId);
    const confirmDelete = () => { if (deletingId) { onDeleteProduct(deletingId); } setDeletingId(null); };
    
    const confirmDeleteOrder = () => { if (deletingOrder) { onDeleteOrder(deletingOrder); } setDeletingOrder(null); };
    
    useEffect(() => {
        if (selectedOrder) {
            const updatedOrder = orders.find(o => o.id === selectedOrder.id);
            if (updatedOrder && JSON.stringify(updatedOrder) !== JSON.stringify(selectedOrder)) { setSelectedOrder(updatedOrder); }
        }
    }, [orders, selectedOrder]);

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-6">Panel de Administrador</h1>
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6"><nav className="-mb-px flex space-x-8"><button onClick={() => setView('products')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'products' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Productos</button><button onClick={() => setView('orders')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'orders' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Pedidos</button><button onClick={() => setView('notifications')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'notifications' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Notificaciones</button><button onClick={() => setView('settings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'settings' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Configuración</button></nav></div>
            
            {view === 'products' && (
                <div>
                    <div className="flex justify-end mb-6"><button onClick={handleAddNew} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full flex items-center"><PlusCircle className="w-5 h-5 mr-2"/>Añadir Producto</button></div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4 font-semibold">Producto</th><th className="p-4 font-semibold">Precio (ARS)</th><th className="p-4 font-semibold">Categoría</th><th className="p-4 font-semibold">Estado</th><th className="p-4 font-semibold">Acciones</th></tr></thead><tbody>{products.map(p => <tr key={p.id} className="border-b dark:border-gray-700"><td className="p-4 flex items-center"><img src={p.imageUrl} className="w-12 h-12 object-cover rounded-md mr-4"/><span className="font-medium">{p.name}</span></td><td className="p-4">{formatPrice(p.price)}</td><td className="p-4">{p.category}</td><td className="p-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.isActive ? 'Activo' : 'Inactivo'}</span></td><td className="p-4 flex items-center space-x-2"><button onClick={() => onToggleProductStatus(p)} className={`p-1 rounded-full ${p.isActive ? 'text-green-500' : 'text-red-500'}`}>{p.isActive ? <Eye size={20}/> : <EyeOff size={20}/>}</button><button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-800"><Edit className="w-5 h-5"/></button><button onClick={() => handleDeleteClick(p.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-5 h-5"/></button></td></tr>)}</tbody></table></div>
                    {showForm && <AdminProductForm product={editingProduct} onSave={handleSave} onCancel={() => setShowForm(false)}/>}
                    {deletingId && <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl w-full max-w-sm"><h2 className="text-xl font-bold mb-4">Confirmar Eliminación</h2><p>¿Estás seguro?</p><div className="flex justify-end space-x-4 pt-6"><button onClick={() => setDeletingId(null)} className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300">Cancelar</button><button onClick={confirmDelete} className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700">Eliminar</button></div></div></div>}
                </div>
            )}

            {view === 'orders' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4 font-semibold">Pedido ID</th><th className="p-4 font-semibold">Fecha</th><th className="p-4 font-semibold">Total</th><th className="p-4 font-semibold">Estado</th><th className="p-4 font-semibold">Acciones</th></tr></thead>
                        <tbody>{orders.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds).map(order => <tr key={order.id} className="border-b dark:border-gray-700">
                            <td className="p-4 font-mono text-sm">{order.orderId.split('-')[1]}</td>
                            <td className="p-4">{new Date(order.createdAt.seconds * 1000).toLocaleDateString()}</td>
                            <td className="p-4">{formatPrice(order.total)}</td>
                            <td className="p-4"><OrderStatusBadge status={order.status} /></td>
                            <td className="p-4 space-x-2"><button onClick={() => setSelectedOrder(order)} className="text-indigo-600 hover:underline text-sm font-medium">Gestionar</button><button onClick={() => setDeletingOrder(order)} className="text-red-500 hover:underline text-sm font-medium">Eliminar</button></td>
                        </tr>)}</tbody>
                    </table>
                    <AdminOrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={onUpdateStatus} />
                    {deletingOrder && <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl w-full max-w-sm"><h2 className="text-xl font-bold mb-4">Eliminar Pedido</h2><p>¿Seguro que quieres eliminar el pedido #{deletingOrder.orderId.split('-')[1]}? Esta acción no se puede deshacer.</p><div className="flex justify-end space-x-4 pt-6"><button onClick={() => setDeletingOrder(null)} className="px-6 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300">Cancelar</button><button onClick={confirmDeleteOrder} className="px-6 py-2 rounded-md text-white bg-red-600 hover:bg-red-700">Eliminar</button></div></div></div>}
                </div>
            )}

            {view === 'notifications' && <AdminNotificationsPage notifications={emailNotifications} />}
            {view === 'settings' && <AdminPaymentSettings paymentInfo={paymentInfo} onSave={onSavePaymentInfo} />}
        </div>
    );
};


// --- Componente Principal de la Aplicación ---
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [allProducts, setAllProducts] = useState([]);
  const [activeProducts, setActiveProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [emailNotifications, setEmailNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: 'success' });
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [thunderEffect, setThunderEffect] = useState({ active: false, position: { x: 0, y: 0 } });

  const triggerThunderEffect = (e) => {
    const synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.1 },
    }).toDestination();
    synth.triggerAttackRelease("8n");
    setThunderEffect({ active: true, position: { x: e.clientX, y: e.clientY } });
    setTimeout(() => setThunderEffect({ active: false, position: { x: 0, y: 0 } }), 500);
  };

  const categories = [...new Set(activeProducts.map(p => p.category))];

  const handleNavigate = (page) => {
    setSelectedProduct(null);
    setSelectedCategory(null);
    setCurrentPage(page);
  };
  
  const handleNavigateToProduct = (product) => {
    setSelectedProduct(product);
    setCurrentPage('product-detail');
  };

  const handleSelectCategory = (category) => {
    setSelectedCategory(category);
    setCurrentPage('products');
  };

  const showNotification = useCallback((message, type = 'success') => { setNotification({ message, type }); }, []);
  
  useEffect(() => { 
    const initAuth = async () => { 
      try { 
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 
        if (token) await signInWithCustomToken(auth, token); 
        else await signInAnonymously(auth); 
      } catch (error) { 
        console.error("Error de autenticación:", error); 
        await signInAnonymously(auth); 
      } 
      onAuthStateChanged(auth, (user) => { 
        if (user) setUserId(user.uid); 
        else setUserId(null); 
        setIsAuthReady(true); 
      }); 
    }; 
    initAuth(); 
  }, []);
  
  useEffect(() => { if (!isAuthReady) return; const unsub = onSnapshot(doc(db, `/artifacts/${appId}/public/data/paymentInfo/config`), (doc) => { setPaymentInfo(doc.data()); }); return () => unsub(); }, [isAuthReady]);
  
  useEffect(() => { 
    if (!isAuthReady) return; 
    const productsCollectionRef = collection(db, `/artifacts/${appId}/public/data/products`);
    const setupAndListen = async () => {
        const querySnapshot = await getDocs(productsCollectionRef);
        if (querySnapshot.empty) {
            console.log("Seeding database with default product.");
            await addDoc(productsCollectionRef, MOCK_PRODUCTS[0]);
        }

        const unsubscribe = onSnapshot(query(productsCollectionRef), (snapshot) => { 
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllProducts(productsData);
            setActiveProducts(productsData.filter(p => p.isActive));
        }, (error) => { 
            showNotification('Error al cargar productos.', 'error'); 
        });
        return unsubscribe;
    };
    let unsubscribe;
    setupAndListen().then(unsub => unsubscribe = unsub);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [isAuthReady, showNotification]);

  useEffect(() => { if (!isAuthReady || !userId) return; const unsub = onSnapshot(collection(db, `/artifacts/${appId}/users/${userId}/cart`), (snapshot) => { setCart(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }, (error) => { showNotification('Error al sincronizar el carrito.', 'error'); }); return () => unsub(); }, [isAuthReady, userId, showNotification]);
  useEffect(() => { if (!isAuthReady || !userId) return; const q = query(collection(db, `/artifacts/${appId}/users/${userId}/orders`)); const unsub = onSnapshot(q, (snapshot) => { setMyOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))); }); return () => unsub(); }, [isAuthReady, userId]);
  useEffect(() => { if (currentPage !== 'admin' || !isAuthReady) return; const q = query(collection(db, `/artifacts/${appId}/public/data/allOrders`)); const unsub = onSnapshot(q, (snapshot) => { setAllOrders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))); }, (error) => { showNotification('Error al cargar todos los pedidos.', 'error'); }); return () => unsub(); }, [currentPage, isAuthReady, showNotification]);
  useEffect(() => { if (currentPage !== 'admin' || !isAuthReady) return; const q = query(collection(db, `/artifacts/${appId}/public/data/emailNotifications`)); const unsub = onSnapshot(q, (snapshot) => { setEmailNotifications(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))); }); return () => unsub(); }, [currentPage, isAuthReady]);

  const handleSaveProduct = async (productData) => { const productsCollectionRef = collection(db, `/artifacts/${appId}/public/data/products`); if (productData.id) { await setDoc(doc(db, `/artifacts/${appId}/public/data/products`, productData.id), productData, { merge: true }); showNotification('Producto actualizado!', 'success'); } else { await addDoc(productsCollectionRef, { ...productData, createdAt: new Date() }); showNotification('Producto añadido!', 'success'); } };
  const handleDeleteProduct = async (productId) => { await deleteDoc(doc(db, `/artifacts/${appId}/public/data/products`, productId)); showNotification('Producto eliminado.', 'error'); };
  const handleToggleProductStatus = async (product) => { const productRef = doc(db, `/artifacts/${appId}/public/data/products`, product.id); await updateDoc(productRef, { isActive: !product.isActive }); showNotification('Estado del producto actualizado.', 'success'); };
  const handleSavePaymentInfo = async (info) => { await setDoc(doc(db, `/artifacts/${appId}/public/data/paymentInfo/config`), info); showNotification('Datos de pago actualizados!', 'success'); };
  const handleAddToCart = useCallback(async (product, quantity) => { if (!userId) return; const itemDocRef = doc(db, `/artifacts/${appId}/users/${userId}/cart`, product.id); const existingItem = cart.find(item => item.id === product.id); if (existingItem) { await setDoc(itemDocRef, { quantity: existingItem.quantity + quantity }, { merge: true }); } else { await setDoc(itemDocRef, { ...product, quantity }); } showNotification(`${product.name} añadido al carrito!`, 'success'); }, [userId, cart, showNotification]);
  const handleUpdateCartQuantity = useCallback(async (productId, quantity) => { if (!userId || quantity < 1) return; await setDoc(doc(db, `/artifacts/${appId}/users/${userId}/cart`, productId), { quantity }, { merge: true }); }, [userId]);
  const handleRemoveFromCart = useCallback(async (productId) => { if (!userId) return; await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/cart`, productId)); showNotification('Producto eliminado.', 'error'); }, [userId, showNotification]);
  
  const handlePlaceOrder = useCallback(async (orderDetails) => {
    if (!userId || cart.length === 0) return;
    const userOrdersRef = collection(db, `/artifacts/${appId}/users/${userId}/orders`);
    const newOrderRef = doc(userOrdersRef);
    const orderData = { id: newOrderRef.id, userId, items: cart, ...orderDetails, status: 'Pendiente de Confirmación', currency: CURRENCY_INFO.code, createdAt: new Date(), orderId: `ORD-${Date.now()}` };
    const batch = writeBatch(db);
    batch.set(newOrderRef, orderData);
    batch.set(doc(db, `/artifacts/${appId}/public/data/allOrders`, newOrderRef.id), orderData);
    cart.forEach(item => batch.delete(doc(db, `/artifacts/${appId}/users/${userId}/cart`, item.id)));
    await batch.commit();
    setLastOrder(orderData);
    setCurrentPage('confirmation');
  }, [userId, cart]);

  const handleUpdateStatus = async (order, newStatus, trackingInfo = null) => {
    const userOrderRef = doc(db, `/artifacts/${appId}/users/${order.userId}/orders`, order.id);
    const publicOrderRef = doc(db, `/artifacts/${appId}/public/data/allOrders`, order.id);
    const updateData = { status: newStatus };
    if (trackingInfo) { 
        updateData.trackingNumber = trackingInfo.number; 
        updateData.trackingGuideFileName = trackingInfo.guideFileName;
        updateData.trackingGuideDataUrl = trackingInfo.guideDataUrl;
    }
    const batch = writeBatch(db);
    batch.update(userOrderRef, updateData);
    batch.update(publicOrderRef, updateData);
    
    const emailRef = doc(collection(db, `/artifacts/${appId}/public/data/emailNotifications`));
    let emailSubject = ''; let emailBody = '';
    if (newStatus === 'En Proceso') {
        emailSubject = `✅ ¡Tu pago ha sido confirmado! Pedido #${order.orderId.split('-')[1]}`;
        emailBody = `Hola ${order.shippingAddress.name},\n\n¡Buenas noticias! Hemos confirmado el pago de tu pedido y ya lo estamos preparando.\n\nGracias por tu compra,\nEl equipo de THUNDER`;
    } else if (newStatus === 'Enviado') {
        emailSubject = `🚚 ¡Tu pedido de THUNDER está en camino! Pedido #${order.orderId.split('-')[1]}`;
        emailBody = `Hola ${order.shippingAddress.name},\n\nTu pedido ha sido enviado. Puedes seguirlo con el número: ${trackingInfo.number}.\n\nGracias por confiar en THUNDER.`;
    }
    if(emailSubject) { batch.set(emailRef, { to: order.shippingAddress.correo, subject: emailSubject, body: emailBody, sentAt: new Date() }); }

    await batch.commit();
    showNotification(`Pedido actualizado a "${newStatus}"`, 'success');
  };
  
  const handleDeleteOrder = async (order) => {
    if (!order || !order.id || !order.userId) { showNotification('Error: Información del pedido incompleta.', 'error'); return; }
    const userOrderRef = doc(db, `/artifacts/${appId}/users/${order.userId}/orders`, order.id);
    const publicOrderRef = doc(db, `/artifacts/${appId}/public/data/allOrders`, order.id);
    const batch = writeBatch(db);
    batch.delete(userOrderRef);
    batch.delete(publicOrderRef);
    try { await batch.commit(); showNotification('Pedido eliminado con éxito.', 'success'); } 
    catch (error) { showNotification('Error al eliminar el pedido.', 'error'); }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage products={activeProducts} onAddToCart={handleAddToCart} onNavigate={handleNavigate} onNavigateToProduct={handleNavigateToProduct} triggerThunderEffect={triggerThunderEffect} />;
      case 'products': return <ProductListPage products={activeProducts} onAddToCart={handleAddToCart} onNavigateToProduct={handleNavigateToProduct} selectedCategory={selectedCategory} triggerThunderEffect={triggerThunderEffect} />;
      case 'product-detail': return <ProductDetailPage product={selectedProduct} onAddToCart={handleAddToCart} onNavigate={handleNavigate} triggerThunderEffect={triggerThunderEffect} />;
      case 'cart': return <CartPage cart={cart} onUpdateQuantity={handleUpdateCartQuantity} onRemoveItem={handleRemoveFromCart} onNavigate={handleNavigate} triggerThunderEffect={triggerThunderEffect} />;
      case 'checkout': return <CheckoutPage cart={cart} onPlaceOrder={handlePlaceOrder} paymentInfo={paymentInfo} onNavigate={handleNavigate} triggerThunderEffect={triggerThunderEffect} />;
      case 'confirmation': return <OrderConfirmationPage order={lastOrder} onNavigate={handleNavigate} />;
      case 'my-orders': return <MyOrdersPage orders={myOrders} onNavigate={handleNavigate} />;
      case 'admin': return <AdminPage products={allProducts} onSaveProduct={handleSaveProduct} onDeleteProduct={handleDeleteProduct} onToggleProductStatus={handleToggleProductStatus} paymentInfo={paymentInfo} onSavePaymentInfo={handleSavePaymentInfo} orders={allOrders} onUpdateStatus={handleUpdateStatus} onDeleteOrder={handleDeleteOrder} emailNotifications={emailNotifications} />;
      default: return <HomePage products={activeProducts} onAddToCart={handleAddToCart} onNavigate={handleNavigate} onNavigateToProduct={handleNavigateToProduct} triggerThunderEffect={triggerThunderEffect} />;
    }
  };
  
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-200 font-sans">
      <style>{`
        @keyframes flash { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
        .animate-flash { animation: flash 0.5s ease-out; }
        @keyframes lightning-fade { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5); } }
        .animate-lightning { animation: lightning-fade 0.5s ease-out; }
      `}</style>
      <ThunderEffect active={thunderEffect.active} position={thunderEffect.position} />
      <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification({ message: '', type: 'success' })} />
      <Header onNavigate={handleNavigate} cartItemCount={cartItemCount} />
      {currentPage === 'products' && <CategoryNav categories={categories} onSelectCategory={handleSelectCategory} selectedCategory={selectedCategory} />}
      <main>{isAuthReady ? renderPage() : <div className="text-center p-20">Cargando tienda...</div>}</main>
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"><div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-500 dark:text-gray-400"><p>&copy; {new Date().getFullYear()} THUNDER. Todos los derechos reservados.</p><button onClick={() => setCurrentPage(currentPage === 'admin' ? 'home' : 'admin')} className="text-sm text-indigo-500 hover:underline mt-2">{currentPage === 'admin' ? 'Volver a la Tienda' : 'Ir al Panel de Administrador'}</button></div></footer>
    </div>
  );
}
