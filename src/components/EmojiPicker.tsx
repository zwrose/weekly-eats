'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, Box, Typography, TextField, InputAdornment } from '@mui/material';
import { Search } from '@mui/icons-material';
import { responsiveDialogStyle } from '../lib/theme';
import { DialogTitle } from './ui';

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

// Food and cooking related emojis with descriptions
const FOOD_EMOJIS = [
  // Stores & Shopping
  { emoji: '🏪', description: 'convenience store' },
  { emoji: '🛒', description: 'shopping cart' },
  { emoji: '🛍️', description: 'shopping bags' },

  // Fruits
  { emoji: '🍎', description: 'red apple' },
  { emoji: '🍏', description: 'green apple' },
  { emoji: '🍐', description: 'pear' },
  { emoji: '🍊', description: 'orange' },
  { emoji: '🍋', description: 'lemon' },
  { emoji: '🍌', description: 'banana' },
  { emoji: '🍉', description: 'watermelon' },
  { emoji: '🍇', description: 'grapes' },
  { emoji: '🍈', description: 'melon' },
  { emoji: '🍓', description: 'strawberry' },
  { emoji: '🫐', description: 'blueberries' },
  { emoji: '🍒', description: 'cherries' },
  { emoji: '🍑', description: 'peach' },
  { emoji: '🥭', description: 'mango' },
  { emoji: '🍍', description: 'pineapple' },
  { emoji: '🥥', description: 'coconut' },
  { emoji: '🥝', description: 'kiwi' },
  { emoji: '🍅', description: 'tomato' },
  { emoji: '🥑', description: 'avocado' },
  { emoji: '🫒', description: 'olive' },

  // Vegetables
  { emoji: '🥬', description: 'leafy green' },
  { emoji: '🥒', description: 'cucumber' },
  { emoji: '🥦', description: 'broccoli' },
  { emoji: '🥕', description: 'carrot' },
  { emoji: '🧄', description: 'garlic' },
  { emoji: '🧅', description: 'onion' },
  { emoji: '🥔', description: 'potato' },
  { emoji: '🍠', description: 'sweet potato' },
  { emoji: '🫑', description: 'bell pepper' },
  { emoji: '🌶️', description: 'hot pepper' },
  { emoji: '🫚', description: 'ginger root' },
  { emoji: '🌽', description: 'corn' },
  { emoji: '🍄', description: 'mushroom' },
  { emoji: '🍆', description: 'eggplant' },
  { emoji: '🫘', description: 'beans' },
  { emoji: '🫛', description: 'pea pod' },
  { emoji: '🌰', description: 'chestnut' },

  // Grains & Legumes
  { emoji: '🌾', description: 'sheaf of rice' },
  { emoji: '🌱', description: 'seedling' },
  { emoji: '🌿', description: 'herb' },
  { emoji: '🥜', description: 'peanuts' },

  // Herbs & Spices
  { emoji: '🧂', description: 'salt' },

  // Bread & Baked Goods
  { emoji: '🥐', description: 'croissant' },
  { emoji: '🥯', description: 'bagel' },
  { emoji: '🍞', description: 'bread' },
  { emoji: '🥖', description: 'baguette' },
  { emoji: '🥨', description: 'pretzel' },
  { emoji: '🥞', description: 'pancakes' },
  { emoji: '🧇', description: 'waffle' },
  { emoji: '🫓', description: 'flatbread' },

  // Dairy & Eggs
  { emoji: '🧀', description: 'cheese' },
  { emoji: '🥚', description: 'egg' },
  { emoji: '🧈', description: 'butter' },
  { emoji: '🥛', description: 'glass of milk' },
  { emoji: '🍼', description: 'baby bottle' },

  // Meat & Poultry
  { emoji: '🥩', description: 'steak' },
  { emoji: '🍗', description: 'poultry leg' },
  { emoji: '🍖', description: 'meat on bone' },
  { emoji: '🥓', description: 'bacon' },
  { emoji: '🦴', description: 'bone' },

  // Seafood
  { emoji: '🦐', description: 'shrimp' },
  { emoji: '🦞', description: 'lobster' },
  { emoji: '🦀', description: 'crab' },
  { emoji: '🦑', description: 'squid' },
  { emoji: '🦪', description: 'oyster' },
  { emoji: '🐟', description: 'fish' },
  { emoji: '🐠', description: 'tropical fish' },
  { emoji: '🐡', description: 'blowfish' },
  { emoji: '🐙', description: 'octopus' },

  // Beverages
  { emoji: '🫖', description: 'teapot' },
  { emoji: '☕', description: 'hot beverage' },
  { emoji: '🍵', description: 'teacup without handle' },
  { emoji: '🧃', description: 'beverage box' },
  { emoji: '🥤', description: 'cup with straw' },
  { emoji: '🧋', description: 'bubble tea' },
  { emoji: '🍶', description: 'sake' },
  { emoji: '🍾', description: 'bottle with popping cork' },
  { emoji: '🍺', description: 'beer mug' },
  { emoji: '🍷', description: 'wine glass' },
  { emoji: '🥂', description: 'clinking glasses' },
  { emoji: '🥃', description: 'tumbler glass' },
  { emoji: '🍸', description: 'cocktail glass' },
  { emoji: '🍹', description: 'tropical drink' },
  { emoji: '🍻', description: 'clinking beer mugs' },
  { emoji: '🧉', description: 'mate' },
  { emoji: '🧊', description: 'ice' },

  // Desserts & Sweets
  { emoji: '🍦', description: 'soft ice cream' },
  { emoji: '🍧', description: 'shaved ice' },
  { emoji: '🍨', description: 'ice cream' },
  { emoji: '🍩', description: 'doughnut' },
  { emoji: '🍪', description: 'cookie' },
  { emoji: '🎂', description: 'birthday cake' },
  { emoji: '🧁', description: 'cupcake' },
  { emoji: '🥧', description: 'pie' },
  { emoji: '🍰', description: 'shortcake' },
  { emoji: '🍫', description: 'chocolate bar' },
  { emoji: '🍬', description: 'candy' },
  { emoji: '🍭', description: 'lollipop' },
  { emoji: '🍮', description: 'custard' },
  { emoji: '🍯', description: 'honey pot' },
  { emoji: '🥮', description: 'moon cake' },

  // Cooking & Kitchen Tools
  { emoji: '🍽️', description: 'fork and knife with plate' },
  { emoji: '🍴', description: 'fork and knife' },
  { emoji: '🥄', description: 'spoon' },
  { emoji: '🥢', description: 'chopsticks' },
  { emoji: '🔪', description: 'kitchen knife' },
  { emoji: '🏺', description: 'amphora' },
  { emoji: '⚱️', description: 'jar' },
  { emoji: '🫙', description: 'jar' },
  { emoji: '🍳', description: 'cooking' },

  // Prepared Foods & Meals
  { emoji: '🍕', description: 'pizza' },
  { emoji: '🌮', description: 'taco' },
  { emoji: '🌯', description: 'burrito' },
  { emoji: '🥙', description: 'stuffed flatbread' },
  { emoji: '🥪', description: 'sandwich' },
  { emoji: '🥗', description: 'green salad' },
  { emoji: '🥘', description: 'paella' },
  { emoji: '🥫', description: 'canned food' },
  { emoji: '🍝', description: 'spaghetti' },
  { emoji: '🍜', description: 'steaming bowl' },
  { emoji: '🍲', description: 'pot of food' },
  { emoji: '🍛', description: 'curry and rice' },
  { emoji: '🍣', description: 'sushi' },
  { emoji: '🍱', description: 'bento box' },
  { emoji: '🥡', description: 'takeout box' },
  { emoji: '🥟', description: 'dumpling' },
  { emoji: '🍤', description: 'fried shrimp' },
  { emoji: '🍢', description: 'oden' },
  { emoji: '🍙', description: 'rice ball' },
  { emoji: '🍚', description: 'cooked rice' },
  { emoji: '🍘', description: 'rice cracker' },
  { emoji: '🍥', description: 'fish cake with swirl' },
  { emoji: '🥠', description: 'fortune cookie' },
  { emoji: '🍡', description: 'dango' },
  { emoji: '🍔', description: 'hamburger' },
  { emoji: '🍟', description: 'french fries' },
  { emoji: '🌭', description: 'hot dog' },

  // Snacks
  { emoji: '🍿', description: 'popcorn' },
];

export default function EmojiPicker({ open, onClose, onSelect, currentEmoji }: EmojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredEmojis = FOOD_EMOJIS.filter(
    (item) =>
      item.emoji.includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      searchTerm === ''
  );

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
    setSearchTerm('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={responsiveDialogStyle}
      slotProps={{
        transition: { onEntered: () => searchInputRef.current?.focus() },
      }}
    >
      <DialogTitle onClose={onClose}>
        <Typography variant="h6">Choose an Emoji</Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          inputRef={searchInputRef}
          placeholder="Search emojis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          margin="normal"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
              gap: 1,
            }}
          >
            {filteredEmojis.map((item) => (
              <Box
                key={item.emoji}
                onClick={() => handleEmojiSelect(item.emoji)}
                sx={{
                  fontSize: '2rem',
                  cursor: 'pointer',
                  p: 1,
                  borderRadius: 1,
                  textAlign: 'center',
                  border:
                    currentEmoji === item.emoji ? '2px solid #1976d2' : '2px solid transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  },
                }}
                title={item.description}
              >
                {item.emoji}
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
