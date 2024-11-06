import {
  reactExtension,
  BlockSpacer,
  Banner,
  InlineLayout,
  BlockStack,
  ChoiceList,
  Choice,
  Link,
  Button,
  Text,
  useApi,
  useInstructions,
  useTranslate,
  useSettings,
  useExtension,
  useEmail,
  useApplyCartLinesChange
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';
import * as React from "react";

// 1. Choose an extension target
export default reactExtension("purchase.checkout.block.render", () => (
    <Extension />
));

function Extension() {
  const applyCartLinesChange = useApplyCartLinesChange();
  const {scriptUrl} = useExtension();
  const login = useEmail()
  const translate = useTranslate();
  const instructions = useInstructions();
  const {shop, lines} = useApi();
  // const applyAttributeChange = useApplyAttributeChange();
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [email, setEmail] = useState('');
  const [wishlist, setWishlist] = useState([]);

  const { title_custom, button_custom, status_custom, text_login, text_get_cart, collapsible} = useSettings()
  const title_text = title_custom || "Save for later";
  const title_button = button_custom || "Save";
  const status_choiced = status_custom || "info"
  const title_login = text_login || 'Want to Keep Your Cart? Log In to Save It!'
  const title_get_cart = text_get_cart || 'Your saved cart will be added to your shopping cart.'

  const baseUrl = scriptUrl.split('/').slice(0, 3).join('/');
  const shopUrl = shop.storefrontUrl.split('/').slice(0, 3).join('/');

  // 2. Check instructions for feature availability, see https://shopify.dev/docs/api/checkout-ui-extensions/apis/cart-instructions for details
  if (!instructions.attributes.canUpdateAttributes) {
    // For checkouts such as draft order invoices, cart attributes may not be allowed
    // Consider rendering a fallback UI or nothing at all, if the feature is unavailable
    return (
      <Banner title="save-for-later" status="warning" >
        {translate("attributeChangesAreNotSupported")}
      </Banner>
    );
  }

  const handleSaveCart = async () => {
    try {
      const response = await fetch(`${baseUrl}/wishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, data: selectedChoices.flat() }),
      });
      if (response.ok) {
        const data = await response.json();
        setWishlist(data.data);
        setCartItems([]);
        setSelectedChoices([]);
      }
    } catch (error) {
      console.log('error', error);
    }
  };

  const handleChange = (newSelectedChoices) => {
    setSelectedChoices(newSelectedChoices);
  };

  const handleLoadCart = async () => {
    for (const item of wishlist) {
      const result = await applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: item,
        quantity: 1,
      });
      if (result.type === 'success') {
        await deleteSavedWishlist()
        setWishlist([]);
      } else {
        console.error('Error adding to cart:', result.errors);
      }
    }
  };

  async function deleteSavedWishlist() {
    try {
      const response = await fetch(`${baseUrl}/wishlist`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email }),
      });
      const data = await response.json();
      console.log('Wishlist deleted:', data);
    } catch (error) {
      console.error('Error deleting wishlist:', error);
    }
  }

  // Check login Customer
  useEffect(() => {
    if (login) {
      setEmail(login);
    } else {
      setEmail('');
    }
  }, [login]);

  // Check if Customer has saved Cart
  async function fetchSavedCart(email) {
    if (email) {
      try {
        const response = await fetch(`${baseUrl}/wishlist?email=${email}`);
        const wishlistData = await response.json();
        if (wishlistData && wishlistData.data && wishlistData.data.items) {
          setWishlist(wishlistData.data.items);
        } else {
          setWishlist([]);
        }
      } catch (error) {
        console.error('Error fetching saved cart:', error);
      }
    }
  }

  useEffect(() => {
    fetchSavedCart(email);
  }, []);

  useEffect(() => {
    if (email) {
      fetchSavedCart(email);
    }
  }, [email]);

  // Current Cart
  useEffect(() => {
    setSelectedChoices([]);
    const unsubscribe = lines.subscribe((item) => {
      console.log('item', item)
      setCartItems(item);
    });
    return () => unsubscribe();
  }, [lines]);

  return (
    <Banner status={status_choiced} title={title_text} collapsible={collapsible}>
      {email && cartItems.length > 0 && wishlist.length === 0 && (
        <ChoiceList value={selectedChoices} onChange={handleChange}>
          <BlockStack>
            {cartItems.map((item) => (
              <Choice key={item.merchandise.id} id={item.merchandise.id}>
                {item.merchandise.title}
              </Choice>
            ))}
          </BlockStack>
        </ChoiceList>
      )}

      <BlockSpacer>
        {!email && <Text>{title_login}</Text>}
        {wishlist.length > 0 && <Text>{title_get_cart}</Text>}
      </BlockSpacer>

      <InlineLayout columns={['auto', 'fill']}>
        {!email ? (
          <Link to={`${shopUrl}/account/login`}>Log in</Link>
        ) : wishlist.length > 0 || cartItems.length === 0 ? (
          <Button onPress={handleLoadCart}>Get saved cart</Button>
        ) : (
          <Button disabled={selectedChoices.length === 0} onPress={handleSaveCart}>
            {title_button}
          </Button>
        )}
      </InlineLayout>
    </Banner>
  );
}
